import { uid } from '../lib/utils.js';
import { isoDate, dayNumber } from '../lib/dates.js';
import { openPopup, closePopup, isPopupOpen } from '../lib/history.js';
import { addCloseX } from '../lib/popups.js';
import { showContextMenu } from '../lib/contextMenu.js';
import { toast } from '../lib/toast.js';
import { attachColorWheel } from '../colorWheel.js';
import { farthestColor } from '../lib/palette.js';
import { getProject, updateProject } from './projects.js';
import { openFile } from './projectFiles.js';
import { HORIZONS, STATUSES, goalOf, isoOf, itemRange, monthOf, quarterOf, progressOf } from './roadmap.js';

/* ============================================================
   ROADMAP ITEM PANEL (2h) — slides in at the right of the
   roadmap (the views stay visible beside it, like Jira). Every
   change is saved right away: name, Roadmap (Now / Next / Later),
   Status, Goal (the project's goal tags, made / edited here),
   Date (a day or span, a month, or a quarter), description, the
   Steps checklist (→ progress) and Documents (project files and
   web links). Esc / × / the logo close it.
============================================================ */
const PANEL = 'roadmap-panel', GOALS = 'goal-picker';
const el = (tag, cls, text) => {
  const x = document.createElement(tag);
  if (cls) x.className = cls;
  if (text != null) x.textContent = text;
  return x;
};
const btn = (cls, text, title) => { const b = el('button', cls, text); b.type = 'button'; if (title) b.title = title; return b; };
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

let cur = null;   // { projectId, itemId, panel, destroy }
export const openItemId = () => (cur ? cur.itemId : null);
export function closeItemPanel(){ if (cur) closePopup(PANEL); }

/* host: the element the panel docks into; onChange(): redraw the views */
export function openItemPanel(host, projectId, itemId, { onChange = () => {}, rename = false } = {}){
  if (cur && cur.itemId === itemId && cur.panel.isConnected){ if (rename) cur.rename(); return; }
  closeItemPanel();
  const item = () => ((getProject(projectId) || {}).timeline || []).find(x => x.id === itemId);
  if (!item()) return;
  const project = () => getProject(projectId);
  const change = fn => { updateProject(projectId, p => { const it = p.timeline.find(x => x.id === itemId); if (it) fn(it, p); }); onChange(); };

  const panel = el('aside', 'rm-panel');
  panel.setAttribute('aria-label', 'Roadmap item');
  const head = el('div', 'rm-p-head');
  const kicker = el('span', 'nav-label', 'Roadmap item');
  const name = el('h2', 'ee-name rm-p-name');
  name.title = 'Click to rename';
  head.append(kicker, name);
  const body = el('div', 'rm-p-body');
  const foot = el('div', 'rm-p-foot');
  const del = btn('danger-link', 'delete item');
  foot.appendChild(del);
  panel.append(head, body, foot);
  host.appendChild(panel);

  const field = (label, cls) => {
    const f = el('div', 'rm-field ' + (cls || ''));
    f.appendChild(el('span', 'rm-label', label));
    const box = el('div', 'rm-field-box');
    f.appendChild(box);
    body.appendChild(f);
    return box;
  };
  const fHorizon = field('Roadmap'), fStatus = field('Status'), fGoal = field('Goal');
  const fDate = field('Date'), fDesc = field('Description'), fSteps = field('Steps', 'rm-steps-field'), fDocs = field('Documents');

  /* ---- name ---- */
  const showName = () => { if (!name.isContentEditable) name.textContent = item().name; };
  const startRename = () => {
    name.contentEditable = 'true';
    name.focus();
    const r = document.createRange();
    r.selectNodeContents(name);
    getSelection().removeAllRanges(); getSelection().addRange(r);
  };
  name.addEventListener('click', () => { if (!name.isContentEditable) startRename(); });
  name.addEventListener('keydown', e => {
    if (e.key === 'Enter'){ e.preventDefault(); name.blur(); }
    else if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); name.textContent = item().name; name.blur(); }
  });
  name.addEventListener('paste', e => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain').replace(/\s+/g, ' ')); });
  name.addEventListener('blur', () => {
    name.contentEditable = 'false';
    const v = name.textContent.trim().slice(0, 80);
    if (v && v !== item().name) change(it => { it.name = v; });
    showName();
  });

  /* ---- roadmap (horizon) + status: one click picks ---- */
  function renderHorizon(){
    fHorizon.innerHTML = '';
    const seg = el('div', 'rm-seg');
    HORIZONS.forEach(h => {
      const b = btn('rm-seg-btn rm-h-' + h.id + (item().horizon === h.id ? ' on' : ''), h.label);
      b.addEventListener('click', () => {
        if (item().horizon === h.id) return;
        change((it, p) => { it.horizon = h.id; it.order = Math.max(-1, ...p.timeline.filter(x => x.horizon === h.id && x.id !== it.id).map(x => x.order)) + 1; });
        renderHorizon();
      });
      seg.appendChild(b);
    });
    fHorizon.appendChild(seg);
  }
  function renderStatus(){
    fStatus.innerHTML = '';
    const row = el('div', 'rm-status-row');
    STATUSES.forEach(s => {
      const b = btn('rm-status-btn' + (item().status === s.id ? ' on' : ''), s.label);
      b.style.setProperty('--sc', s.color); b.style.setProperty('--si', s.ink);
      b.addEventListener('click', () => { change(it => { it.status = s.id; }); renderStatus(); });
      row.appendChild(b);
    });
    fStatus.appendChild(row);
  }

  /* ---- goal: the project's goals, picked / made / edited in a small pop-up ---- */
  function renderGoal(){
    fGoal.innerHTML = '';
    const wrap = el('div', 'rm-goal-wrap');
    const g = goalOf(project(), item());
    const b = btn('rm-goal-btn' + (g ? '' : ' empty'), null, 'Pick a goal');
    if (g){
      const dot = el('i'); dot.style.background = g.color;
      b.style.setProperty('--gc', g.color);
      b.append(dot, el('span', null, g.name));
    } else b.textContent = '+ Goal';
    b.addEventListener('click', () => (isPopupOpen(GOALS) ? closePopup(GOALS) : openGoalPicker(wrap, b)));
    wrap.appendChild(b);
    fGoal.appendChild(wrap);
  }
  function openGoalPicker(wrap){
    const pop = el('div', 'tp-pop rm-goal-pop');
    let destroyWheel = null;
    const onDoc = e => { if (!pop.contains(e.target) && !wrap.contains(e.target) && !e.target.closest('.cw-pop') && !e.target.closest('[data-back]')) closePopup(GOALS); };
    openPopup(GOALS, () => { if (destroyWheel) destroyWheel(); pop.remove(); document.removeEventListener('pointerdown', onDoc, true); });
    document.addEventListener('pointerdown', onDoc, true);
    addCloseX(pop, () => closePopup(GOALS));
    wrap.appendChild(pop);

    function list(){
      if (destroyWheel){ destroyWheel(); destroyWheel = null; }
      pop.querySelectorAll(':scope > :not(.pop-x)').forEach(n => n.remove());
      const pick = id => { change(it => { it.goalId = id; }); closePopup(GOALS); renderGoal(); };
      const none = el('div', 'tp-row' + (!item().goalId ? ' on' : ''));
      none.tabIndex = 0;
      none.append(el('i', 'tp-dot rm-no-goal'), el('span', 'tp-name', 'No goal'));
      none.addEventListener('click', () => pick(null));
      pop.appendChild(none);
      (project().goals || []).forEach(g => {
        const row = el('div', 'tp-row' + (item().goalId === g.id ? ' on' : ''));
        row.tabIndex = 0;
        const dot = el('i', 'tp-dot'); dot.style.background = g.color;
        const edit = btn('tp-edit', '✎', 'Edit goal');
        edit.addEventListener('click', e => { e.stopPropagation(); form(g); });
        row.append(dot, el('span', 'tp-name', g.name), edit);
        row.addEventListener('click', () => pick(g.id));
        row.addEventListener('keydown', e => { if (e.key === 'Enter') pick(g.id); });
        pop.appendChild(row);
      });
      const add = btn('tp-new', '+ New goal');
      add.addEventListener('click', () => form(null));
      pop.appendChild(add);
    }
    function form(goal){
      list();
      pop.querySelector('.tp-new').remove();
      const draft = goal ? { ...goal } : { id: uid(), name: '', color: farthestColor((project().goals || []).map(x => x.color)) };
      const f = el('div', 'tp-form');
      const line = el('div', 'tp-form-row');
      const colorWrap = el('div', 'tp-color');
      const sw = btn('tp-swatch', null, 'Goal color');
      sw.style.background = draft.color;
      colorWrap.appendChild(sw);
      const input = el('input', 'tp-name-in');
      input.placeholder = 'Goal name'; input.maxLength = 32; input.value = draft.name;
      line.append(colorWrap, input);
      const actions = el('div', 'tp-form-actions');
      if (goal){
        const d = btn('danger-link', 'delete');
        d.addEventListener('click', () => {
          updateProject(projectId, p => {
            p.goals = p.goals.filter(x => x.id !== goal.id);
            p.timeline.forEach(it => { if (it.goalId === goal.id) it.goalId = null; });
          });
          onChange(); renderGoal(); list();
          toast('Deleted goal “' + goal.name + '”');
        });
        actions.appendChild(d);
      }
      const cancel = btn('ghost-btn', 'Cancel'), save = btn('primary-btn', goal ? 'Save' : 'Add');
      actions.append(cancel, save);
      f.append(line, actions);
      pop.appendChild(f);
      destroyWheel = attachColorWheel(sw, () => draft.color, hex => { draft.color = hex; sw.style.background = hex; });
      cancel.addEventListener('click', list);
      const commit = () => {
        draft.name = input.value.trim();
        if (!draft.name){ input.focus(); return; }
        updateProject(projectId, p => {
          const i = p.goals.findIndex(x => x.id === draft.id);
          if (i < 0) p.goals.push(draft); else p.goals[i] = draft;
          if (!goal){ const it = p.timeline.find(x => x.id === itemId); if (it) it.goalId = draft.id; }   // a new goal is picked right away
        });
        onChange(); renderGoal();
        if (goal) list(); else closePopup(GOALS);
      };
      save.addEventListener('click', commit);
      input.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); commit(); } e.stopPropagation(); });
      input.focus();
    }
    list();
  }

  /* ---- date: a day (or a span), a month, or a quarter ---- */
  function renderDate(){
    fDate.innerHTML = '';
    const w = item().when;
    const seg = el('div', 'rm-seg rm-seg-small');
    [['day', 'Day'], ['month', 'Month'], ['quarter', 'Quarter']].forEach(([k, label]) => {
      const b = btn('rm-seg-btn' + (w.kind === k ? ' on' : ''), label);
      b.addEventListener('click', () => {
        if (w.kind === k) return;
        const start = isoOf(itemRange(w)[0]);    // keep roughly the same time
        const next = k === 'day' ? { kind: 'day', date: start, end: null } : k === 'month' ? monthOf(start) : quarterOf(start);
        change(it => { it.when = next; });
        renderDate();
      });
      seg.appendChild(b);
    });
    fDate.appendChild(seg);
    const row = el('div', 'rm-date-row');
    if (w.kind === 'day'){
      const a = el('input', 'rm-in rm-in-date'); a.type = 'date'; a.value = w.date;
      const span = el('label', 'rm-check');
      const box = el('input'); box.type = 'checkbox'; box.checked = !!w.end;
      span.append(box, ' several days');
      const b = el('input', 'rm-in rm-in-date'); b.type = 'date'; b.value = w.end || ''; b.hidden = !w.end;
      const arrow = el('span', 'rm-arrow', '→'); arrow.hidden = !w.end;
      a.addEventListener('change', () => {
        if (!a.value){ a.value = item().when.date; return; }
        const cw = item().when, len = cw.end ? dayNumber(cw.end) - dayNumber(cw.date) : 0;   // moving the start keeps the length
        change(it => { it.when = { kind: 'day', date: a.value, end: cw.end ? isoOf(dayNumber(a.value) + len) : null }; });
        renderDate();
      });
      box.addEventListener('change', () => {
        const cw = item().when;
        change(it => { it.when = { kind: 'day', date: cw.date, end: box.checked ? isoOf(dayNumber(cw.date) + 6) : null }; });
        renderDate();
      });
      b.addEventListener('change', () => {
        const cw = item().when;
        if (!b.value || b.value <= cw.date){ b.value = cw.end; toast('The end must be after the start'); return; }
        change(it => { it.when = { ...cw, end: b.value }; });
      });
      row.append(a, arrow, b, span);
    } else if (w.kind === 'month'){
      const m = el('select', 'rm-in');
      MONTH_NAMES.forEach((n, i) => m.appendChild(new Option(n, String(i + 1).padStart(2, '0'))));
      m.value = w.ym.slice(5, 7);
      const y = el('input', 'rm-in rm-in-year'); y.type = 'number'; y.min = 2000; y.max = 2100; y.value = w.ym.slice(0, 4);
      const set = () => { const yy = Math.min(2100, Math.max(2000, +y.value || new Date().getFullYear())); change(it => { it.when = { kind: 'month', ym: yy + '-' + m.value }; }); };
      m.addEventListener('change', set); y.addEventListener('change', set);
      row.append(m, y);
    } else {
      const q = el('select', 'rm-in');
      ['Q1 · Jan–Mar', 'Q2 · Apr–Jun', 'Q3 · Jul–Sep', 'Q4 · Oct–Dec'].forEach((n, i) => q.appendChild(new Option(n, i + 1)));
      q.value = w.q;
      const y = el('input', 'rm-in rm-in-year'); y.type = 'number'; y.min = 2000; y.max = 2100; y.value = w.y;
      const set = () => { const yy = Math.min(2100, Math.max(2000, +y.value || new Date().getFullYear())); change(it => { it.when = { kind: 'quarter', y: yy, q: +q.value }; }); };
      q.addEventListener('change', set); y.addEventListener('change', set);
      row.append(q, y);
    }
    fDate.appendChild(row);
  }

  /* ---- description (saved as you type) ---- */
  const desc = el('textarea', 'rm-in rm-desc');
  desc.placeholder = 'What is it, and why?';
  desc.value = item().desc || '';
  let descTimer = null;
  const flushDesc = () => { clearTimeout(descTimer); descTimer = null; if (item() && desc.value !== item().desc) change(it => { it.desc = desc.value; }); };
  desc.addEventListener('input', () => { clearTimeout(descTimer); descTimer = setTimeout(flushDesc, 400); });
  desc.addEventListener('blur', flushDesc);
  fDesc.appendChild(desc);

  /* ---- steps: a checklist; done / all = the item's progress ---- */
  function renderSteps(focusAdd){
    fSteps.innerHTML = '';
    const it = item(), pr = progressOf(it);
    if (pr){
      const top = el('div', 'rm-steps-top');
      const bar = el('span', 'rm-prog-bar big'), fill = el('i');
      fill.style.width = (pr.done / pr.total * 100) + '%';
      bar.appendChild(fill);
      top.append(bar, el('span', 'rm-prog-text', pr.done + ' / ' + pr.total + ' done'));
      fSteps.appendChild(top);
    }
    it.steps.forEach(s => {
      const row = el('div', 'rm-step' + (s.done ? ' done' : ''));
      const box = el('input'); box.type = 'checkbox'; box.checked = s.done;
      box.addEventListener('change', () => { change(x => { const st = x.steps.find(y => y.id === s.id); if (st) st.done = box.checked; }); renderSteps(); });
      const text = el('span', 'rm-step-text', s.text);
      text.title = 'Double-click to edit';
      text.addEventListener('dblclick', () => {
        const inp = el('input', 'rm-in rm-step-in'); inp.value = s.text;
        text.replaceWith(inp); inp.focus(); inp.select();
        let done = false;
        const fin = save => { if (done) return; done = true; const v = inp.value.trim(); if (save && v && v !== s.text) change(x => { const st = x.steps.find(y => y.id === s.id); if (st) st.text = v; }); renderSteps(); };
        inp.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); fin(true); } if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); fin(false); } });
        inp.addEventListener('blur', () => fin(true));
      });
      const x = btn('rm-x', '×', 'Remove step');
      x.addEventListener('click', () => { change(y => { y.steps = y.steps.filter(z => z.id !== s.id); }); renderSteps(); });
      const lbl = el('label', 'rm-step-label');
      lbl.append(box, text);
      row.append(lbl, x);
      fSteps.appendChild(row);
    });
    const add = el('input', 'rm-in rm-step-add');
    add.placeholder = '+ Add a step (Enter)';
    add.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const v = add.value.trim();
      if (!v) return;
      change(x => { x.steps.push({ id: uid(), text: v, done: false }); });
      renderSteps(true);
    });
    fSteps.appendChild(add);
    if (focusAdd) add.focus();
  }

  /* ---- documents: project files and web links ---- */
  function renderDocs(){
    fDocs.innerHTML = '';
    const it = item(), files = project().files || [];
    it.docs.forEach(d => {
      const f = d.kind === 'file' ? files.find(x => x.id === d.fileId) : null;
      if (d.kind === 'file' && !f) return;
      const row = el('div', 'rm-doc');
      const link = btn('rm-doc-link');
      link.append(el('span', 'rm-doc-icon', d.kind === 'file' ? '▤' : '🔗'), el('span', 'rm-doc-name', d.kind === 'file' ? f.name : (d.label || d.url.replace(/^https?:\/\//, ''))));
      link.title = d.kind === 'file' ? 'Open ' + f.name : d.url;
      link.addEventListener('click', () => d.kind === 'file' ? openFile(f) : window.open(d.url, '_blank', 'noopener'));
      const x = btn('rm-x', '×', 'Remove from this item');
      x.addEventListener('click', () => { change(y => { y.docs = y.docs.filter(z => z.id !== d.id); }); renderDocs(); });
      row.append(link, x);
      fDocs.appendChild(row);
    });
    const actions = el('div', 'rm-doc-actions');
    const addFile = btn('ghost-btn pj-small-btn', '+ Project file');
    addFile.addEventListener('click', () => {
      const linked = new Set(item().docs.map(d => d.fileId).filter(Boolean));
      const choices = (project().files || []).filter(f => !linked.has(f.id));
      if (!choices.length){ toast((project().files || []).length ? 'Every file is already linked' : 'No files in this project yet — add some in Files or on the Board'); return; }
      const r = addFile.getBoundingClientRect();
      showContextMenu(r.left, r.bottom + 6, choices.slice(0, 14).map(f => ({
        label: f.name, action: () => { change(y => { y.docs.push({ id: uid(), kind: 'file', fileId: f.id }); }); renderDocs(); }
      })));
    });
    const addLink = btn('ghost-btn pj-small-btn', '+ Web link');
    addLink.addEventListener('click', () => {
      actions.hidden = true;
      const f = el('div', 'rm-link-form');
      const url = el('input', 'rm-in'); url.placeholder = 'https://…';
      const label = el('input', 'rm-in'); label.placeholder = 'Label (optional)';
      const ok = btn('primary-btn pj-small-btn', 'Add'), no = btn('ghost-btn pj-small-btn', 'Cancel');
      const row2 = el('div', 'rm-link-actions'); row2.append(no, ok);
      f.append(url, label, row2);
      fDocs.appendChild(f);
      url.focus();
      const commit = () => {
        let u = url.value.trim();
        if (!u){ url.focus(); return; }
        if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
        change(y => { y.docs.push({ id: uid(), kind: 'url', url: u, label: label.value.trim() }); });
        renderDocs();
      };
      ok.addEventListener('click', commit);
      no.addEventListener('click', renderDocs);
      [url, label].forEach(i => i.addEventListener('keydown', e => {
        if (e.key === 'Enter'){ e.preventDefault(); commit(); }
        if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); renderDocs(); }
      }));
    });
    actions.append(addFile, addLink);
    fDocs.appendChild(actions);
  }

  /* ---- delete ---- */
  del.addEventListener('click', () => {
    const it = item();
    updateProject(projectId, p => { p.timeline = p.timeline.filter(x => x.id !== itemId); });
    closeItemPanel();
    onChange();
    toast('Deleted “' + it.name + '”');
  });

  const hide = () => {
    flushDesc();
    if (name.isContentEditable) name.blur();
    panel.classList.add('closing');
    setTimeout(() => panel.remove(), 160);
    if (cur && cur.panel === panel) cur = null;
    onChange();
  };
  openPopup(PANEL, hide);
  addCloseX(panel, closeItemPanel);
  cur = { projectId, itemId, panel, rename: startRename };

  showName(); renderHorizon(); renderStatus(); renderGoal(); renderDate(); renderSteps(); renderDocs();
  onChange();
  if (rename) startRename();
}
