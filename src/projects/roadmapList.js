import { store } from '../lib/storage.js';
import { showContextMenu } from '../lib/contextMenu.js';
import { HORIZONS, STATUSES, goalOf, itemRange, progressOf, byOrder,
         statusChip, horizonChip, goalChip, dateChip, progressBar } from './roadmap.js';

/* ============================================================
   ROADMAP · LIST (2h) — every item as a table row, like your
   second Jira photo: Summary · Roadmap · Status · Goal · Date ·
   Progress · Documents. Click a column title to sort (again:
   reverse); "Group" splits the rows by Roadmap / Status / Goal.
   The Roadmap and Status chips change with a click; the rest of
   the row opens the item. "+ Create" at the bottom adds one.
============================================================ */
const el = (tag, cls, text) => {
  const x = document.createElement(tag);
  if (cls) x.className = cls;
  if (text != null) x.textContent = text;
  return x;
};
const COLS = [
  { key: 'name', label: 'Summary' },
  { key: 'horizon', label: 'Roadmap' },
  { key: 'status', label: 'Status' },
  { key: 'goal', label: 'Goal' },
  { key: 'date', label: 'Date' },
  { key: 'progress', label: 'Progress' },
  { key: 'docs', label: 'Documents' }
];
const GROUPS = [['none', 'No grouping'], ['horizon', 'Group: Roadmap'], ['status', 'Group: Status'], ['goal', 'Group: Goal']];

export function mountList(host, ctx){
  const prefs = { sort: 'horizon', dir: 1, group: 'none', ...store.get('ideally.roadmapList', {}) };
  const savePrefs = () => store.set('ideally.roadmapList', prefs);

  const groupSel = el('select', 'rm-in rm-group-sel');
  GROUPS.forEach(([v, l]) => groupSel.appendChild(new Option(l, v)));
  groupSel.value = prefs.group;
  groupSel.addEventListener('change', () => { prefs.group = groupSel.value; savePrefs(); render(); });
  ctx.slot.appendChild(groupSel);

  const scroll = el('div', 'rm-table-wrap');
  const table = el('table', 'rm-table');
  scroll.appendChild(table);
  host.appendChild(scroll);
  let typing = false;

  const docCount = it => it.docs.filter(d => d.kind === 'url' || (ctx.project().files || []).some(f => f.id === d.fileId)).length;
  const keyOf = {
    name: it => it.name.toLowerCase(),
    horizon: it => HORIZONS.findIndex(h => h.id === it.horizon) * 1e6 + it.order,
    status: it => STATUSES.findIndex(s => s.id === it.status),
    goal: it => (goalOf(ctx.project(), it) || { name: '￿' }).name.toLowerCase(),
    date: it => itemRange(it.when)[0],
    progress: it => { const p = progressOf(it); return p ? p.done / p.total : -1; },
    docs: docCount
  };
  const compare = (a, b) => {
    const ka = keyOf[prefs.sort](a), kb = keyOf[prefs.sort](b);
    return (ka < kb ? -1 : ka > kb ? 1 : byOrder(a, b)) * prefs.dir;
  };

  function render(){
    table.innerHTML = '';
    const p = ctx.project();
    /* head */
    const thead = el('thead'), hr = el('tr');
    COLS.forEach(c => {
      const th = el('th', 'rm-th-' + c.key + (prefs.sort === c.key ? ' sorted' : ''));
      const b = el('button', 'rm-th-btn', c.label + (prefs.sort === c.key ? (prefs.dir > 0 ? ' ↑' : ' ↓') : ''));
      b.type = 'button';
      b.title = 'Sort by ' + c.label;
      b.addEventListener('click', () => {
        if (prefs.sort === c.key) prefs.dir = -prefs.dir; else { prefs.sort = c.key; prefs.dir = 1; }
        savePrefs(); render();
      });
      th.appendChild(b);
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    table.appendChild(thead);

    /* rows, maybe in groups */
    const tbody = el('tbody');
    const items = ctx.items().sort(compare);
    const groups = prefs.group === 'none' ? [{ label: null, items }]
      : prefs.group === 'horizon' ? HORIZONS.map(h => ({ label: h.label, cls: 'rm-h-' + h.id, items: items.filter(i => i.horizon === h.id) }))
      : prefs.group === 'status' ? STATUSES.map(s => ({ label: s.label, color: s.color, items: items.filter(i => i.status === s.id) }))
      : [...(p.goals || []).map(g => ({ label: g.name, color: g.color, items: items.filter(i => i.goalId === g.id) })),
         { label: 'No goal', items: items.filter(i => !goalOf(p, i)) }];
    groups.forEach(g => {
      if (g.label != null){
        if (!g.items.length) return;
        const tr = el('tr', 'rm-group-row');
        const td = el('td');
        td.colSpan = COLS.length;
        const dot = el('i', 'rm-group-dot' + (g.cls ? ' ' + g.cls : ''));
        if (g.color) dot.style.background = g.color;
        td.append(dot, el('span', null, g.label), el('span', 'rm-group-count', String(g.items.length)));
        tr.appendChild(td);
        tbody.appendChild(tr);
      }
      g.items.forEach(it => tbody.appendChild(row(it, p)));
    });
    if (!items.length){
      const tr = el('tr', 'rm-empty-row'), td = el('td', null, ctx.filtering() ? 'No items match the search / filter.' : 'No items yet — add the first one below, or with + Item.');
      td.colSpan = COLS.length;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
    tbody.appendChild(createRow());
    table.appendChild(tbody);
  }

  function row(it, p){
    const tr = el('tr', 'rm-row' + (ctx.isOpen(it.id) ? ' open' : '') + (it.status === 'done' ? ' done' : ''));
    tr.dataset.id = it.id;
    tr.tabIndex = 0;
    const td = (cls, ...kids) => { const c = el('td', cls); kids.filter(Boolean).forEach(k => c.append(k)); tr.appendChild(c); return c; };
    td('rm-td-name', el('span', 'rm-row-name', it.name));
    const hc = horizonChip(it); hc.classList.add('clickable'); hc.dataset.edit = 'horizon'; hc.title = 'Change';
    td('', hc);
    const sc = statusChip(it); sc.classList.add('clickable'); sc.dataset.edit = 'status'; sc.title = 'Change';
    td('', sc);
    const g = goalOf(p, it);
    td('', g ? goalChip(g) : el('span', 'rm-none', '—'));
    td('', dateChip(it));
    td('rm-td-progress', progressBar(it) || el('span', 'rm-none', '—'));
    const n = docCount(it);
    td('rm-td-docs', n ? el('span', 'rm-card-docs', '▤ ' + n) : el('span', 'rm-none', '—'));
    return tr;
  }

  function createRow(){
    const tr = el('tr', 'rm-create-row');
    const td = el('td');
    td.colSpan = COLS.length;
    if (!typing){
      const b = el('button', 'rm-add-btn', '+ Create');
      b.type = 'button';
      b.addEventListener('click', () => { typing = true; render(); });
      td.appendChild(b);
    } else {
      const inp = el('input', 'rm-add-in');
      inp.placeholder = 'Name, then Enter (goes to Now)';
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter'){ e.preventDefault(); const v = inp.value.trim(); if (v) ctx.create({ name: v }); }
        else if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); typing = false; render(); }
      });
      inp.addEventListener('blur', () => setTimeout(() => { if (typing && !inp.value.trim() && document.activeElement !== inp){ typing = false; render(); } }, 120));
      td.appendChild(inp);
      requestAnimationFrame(() => inp.focus());
    }
    tr.appendChild(td);
    return tr;
  }

  table.addEventListener('click', e => {
    const tr = e.target.closest('.rm-row');
    if (!tr) return;
    const chip = e.target.closest('[data-edit]');
    if (!chip){ ctx.open(tr.dataset.id); return; }
    const r = chip.getBoundingClientRect(), id = tr.dataset.id;
    const options = chip.dataset.edit === 'horizon'
      ? HORIZONS.map(h => ({ label: h.label, action: () => ctx.update(id, (it, pr) => {
          if (it.horizon === h.id) return;
          it.horizon = h.id;
          it.order = Math.max(-1, ...pr.timeline.filter(x => x.horizon === h.id && x.id !== id).map(x => x.order)) + 1;
        }) }))
      : STATUSES.map(s => ({ label: s.label, action: () => ctx.update(id, it => { it.status = s.id; }) }));
    showContextMenu(r.left, r.bottom + 4, options);
  });
  table.addEventListener('keydown', e => {
    const tr = e.target.closest('.rm-row');
    if (tr && e.key === 'Enter' && e.target === tr){ e.preventDefault(); ctx.open(tr.dataset.id); }
  });

  return { render, destroy(){} };
}
