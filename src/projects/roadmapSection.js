import { uid } from '../lib/utils.js';
import { store } from '../lib/storage.js';
import { isoDate } from '../lib/dates.js';
import { openPopup, closePopup, isPopupOpen } from '../lib/history.js';
import { addCloseX } from '../lib/popups.js';
import { getProject, updateProject } from './projects.js';
import { HORIZONS, STATUSES, normalizeItem } from './roadmap.js';
import { openItemPanel, closeItemPanel, openItemId } from './roadmapPanel.js';
import { mountColumns } from './roadmapColumns.js';
import { mountList } from './roadmapList.js';
import { mountTimeline } from './timeline.js';

/* ============================================================
   PROJECT ROADMAP (2h, was the Timeline 2d) — the project's items
   in three views of the same data, like Jira Product Discovery:
   - Columns: Now / Next / Later cards, dragged between columns
   - List:    a table, sortable, grouped by Roadmap / Status / Goal
   - Timeline: the horizontal axis (2d)
   Above them: the view tabs, overall progress, search, a filter
   (status / roadmap / goal — shared by the three views) and
   + Item. Clicking an item opens it in the side panel.
============================================================ */
const VIEWS = [
  { id: 'columns', label: 'Columns', mount: mountColumns, icon: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="11" rx="1"/><rect x="17" y="4" width="4" height="7" rx="1"/>' },
  { id: 'list', label: 'List', mount: mountList, icon: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>' },
  { id: 'timeline', label: 'Timeline', mount: mountTimeline, icon: '<path d="M3 12h18"/><circle cx="7" cy="12" r="2"/><circle cx="15" cy="12" r="2"/><path d="M7 6v4M15 14v4"/>' }
];
const FILTER = 'roadmap-filter';
const filters = new Map();   // project id → { q, statuses, horizons, goals } while the app is open

const el = (tag, cls, text) => {
  const x = document.createElement(tag);
  if (cls) x.className = cls;
  if (text != null) x.textContent = text;
  return x;
};

export function mountRoadmap(root, projectId){
  let viewId = store.get('ideally.roadmapView', 'columns');
  if (!VIEWS.some(v => v.id === viewId)) viewId = 'columns';
  const flt = filters.get(projectId) || { q: '', statuses: new Set(), horizons: new Set(), goals: new Set() };
  filters.set(projectId, flt);
  let alive = true;

  /* ---- skeleton: [ main: toolbar + view ] [ side panel ] ---- */
  const main = el('div', 'rm-main');
  const head = el('div', 'pj-sec-head rm-head');
  const tabs = el('div', 'rm-tabs');
  const tabBtns = {};
  VIEWS.forEach(v => {
    const b = el('button', 'rm-tab');
    b.type = 'button';
    b.innerHTML = '<svg viewBox="0 0 24 24">' + v.icon + '</svg>';
    b.append(v.label);
    b.addEventListener('click', () => setView(v.id));
    tabs.appendChild(b);
    tabBtns[v.id] = b;
  });
  const progress = el('div', 'tl-progress');
  const progBar = el('span', 'tl-prog-bar'), progFill = el('i'), progText = el('span', 'tl-prog-text');
  progBar.appendChild(progFill);
  progress.append(progBar, progText);
  const search = el('input', 'rm-search');
  search.placeholder = 'Find an item';
  search.value = flt.q;
  const filterWrap = el('div', 'rm-filter-wrap');
  const filterBtn = el('button', 'ghost-btn pj-small-btn rm-filter-btn');
  filterBtn.type = 'button';
  filterWrap.appendChild(filterBtn);
  const slot = el('div', 'rm-slot');                  // the open view's own controls
  const newBtn = el('button', 'primary-btn pj-small-btn', '+ Item');
  newBtn.type = 'button';
  newBtn.title = 'New roadmap item';
  head.append(tabs, progress, el('span', 'pj-grow'), slot, search, filterWrap, newBtn);
  const host = el('div', 'rm-host');
  main.append(head, host);
  root.appendChild(main);

  /* ---- data ---- */
  const project = () => getProject(projectId);
  const all = () => (project() || {}).timeline || [];
  const matches = it => {
    if (flt.q && !(it.name + ' ' + it.desc).toLowerCase().includes(flt.q.toLowerCase())) return false;
    if (flt.statuses.size && !flt.statuses.has(it.status)) return false;
    if (flt.horizons.size && !flt.horizons.has(it.horizon)) return false;
    if (flt.goals.size && !flt.goals.has(it.goalId || 'none')) return false;
    return true;
  };
  const filtering = () => !!(flt.q || flt.statuses.size || flt.horizons.size || flt.goals.size);

  const ctx = {
    projectId,
    project,
    items: () => all().filter(matches),
    all,
    filtering,
    slot,
    isOpen: id => openItemId() === id,
    open: (id, rename) => openItemPanel(root, projectId, id, { onChange: refresh, rename }),
    update(id, fn){ updateProject(projectId, p => { const it = p.timeline.find(x => x.id === id); if (it) fn(it, p); }); refresh(); },
    /* a new item: today, Pending, at the end of its column; open: show it in the panel, name ready to type */
    create(fields = {}, open = false){
      const horizon = fields.horizon || 'now';
      const it = { id: uid(), name: fields.name || 'New item', desc: '', created: Date.now(), horizon, status: 'pending', goalId: null,
                   when: { kind: 'day', date: isoDate(new Date()), end: null }, steps: [], docs: [],
                   order: Math.max(-1, ...all().filter(x => x.horizon === horizon).map(x => x.order)) + 1, ...fields };
      normalizeItem(it);
      updateProject(projectId, p => { p.timeline.push(it); });
      refresh();
      if (open) ctx.open(it.id, true);
      return it;
    }
  };

  /* ---- views ---- */
  let view = null;
  function setView(id){
    if (view && id === viewId) return;
    if (view) view.destroy();
    viewId = id;
    store.set('ideally.roadmapView', id);
    Object.entries(tabBtns).forEach(([k, b]) => b.classList.toggle('on', k === id));
    host.innerHTML = ''; slot.innerHTML = '';
    host.className = 'rm-host rm-view-' + id;
    view = VIEWS.find(v => v.id === id).mount(host, ctx);
    refresh();
  }
  function refresh(){
    if (!alive) return;
    const its = all();
    const done = its.filter(i => i.status === 'done').length;
    progFill.style.width = (its.length ? done / its.length * 100 : 0) + '%';
    progText.textContent = its.length ? done + ' / ' + its.length + ' done' : 'nothing planned yet';
    const n = flt.statuses.size + flt.horizons.size + flt.goals.size;
    filterBtn.textContent = n ? 'Filter · ' + n : 'Filter';
    filterBtn.classList.toggle('on', n > 0);
    if (view) view.render();
  }

  /* ---- search + filter ---- */
  search.addEventListener('input', () => { flt.q = search.value.trim(); refresh(); });
  search.addEventListener('keydown', e => { if (e.key === 'Escape' && search.value){ e.preventDefault(); e.stopPropagation(); search.value = ''; flt.q = ''; refresh(); } });
  filterBtn.addEventListener('click', () => (isPopupOpen(FILTER) ? closePopup(FILTER) : openFilter()));
  function openFilter(){
    const pop = el('div', 'rm-filter-pop');
    const onDoc = e => { if (!filterWrap.contains(e.target) && !e.target.closest('[data-back]')) closePopup(FILTER); };
    openPopup(FILTER, () => { pop.remove(); document.removeEventListener('pointerdown', onDoc, true); });
    document.addEventListener('pointerdown', onDoc, true);
    addCloseX(pop, () => closePopup(FILTER));
    const group = (title, set, options) => {
      pop.appendChild(el('div', 'nav-label', title));
      options.forEach(([id, label, color]) => {
        const row = el('label', 'rm-filter-row');
        const box = el('input'); box.type = 'checkbox'; box.checked = set.has(id);
        box.addEventListener('change', () => { box.checked ? set.add(id) : set.delete(id); refresh(); });
        const dot = el('i', 'rm-filter-dot');
        if (color) dot.style.background = color; else dot.classList.add('none');
        row.append(box, dot, el('span', null, label));
        pop.appendChild(row);
      });
    };
    group('Status', flt.statuses, STATUSES.map(s => [s.id, s.label, s.color]));
    group('Roadmap', flt.horizons, HORIZONS.map(h => [h.id, h.label, null]));
    group('Goal', flt.goals, [...(project().goals || []).map(g => [g.id, g.name, g.color]), ['none', 'No goal', null]]);
    const clear = el('button', 'danger-link rm-filter-clear', 'clear filters');
    clear.type = 'button';
    clear.addEventListener('click', () => {
      flt.statuses.clear(); flt.horizons.clear(); flt.goals.clear();
      pop.querySelectorAll('input[type=checkbox]').forEach(b => { b.checked = false; });
      refresh();
    });
    pop.appendChild(clear);
    filterWrap.appendChild(pop);
  }

  newBtn.addEventListener('click', () => ctx.create({}, true));

  setView(viewId);
  return {
    destroy(){
      closeItemPanel();
      alive = false;
      if (view) view.destroy();
      closePopup(FILTER);
    }
  };
}
