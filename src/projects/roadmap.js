import { dayNumber, isoDate, daysInMonth, pad } from '../lib/dates.js';

/* ============================================================
   ROADMAP ITEMS (2h) — the data helpers shared by the project's
   Columns / List / Timeline views and the item side panel.
   Item (in project.timeline):
   { id, name, desc, created,
     horizon: 'now' | 'next' | 'later',   order (within its column),
     status:  'ontrack' | 'atrisk' | 'offtrack' | 'pending' | 'done',
     goalId:  a project goal's id, or null      (project.goals: [{ id, name, color }])
     when:    { kind: 'day', date, end|null }    one day, or a span
            | { kind: 'month', ym: 'YYYY-MM' }   a rough date: a month
            | { kind: 'quarter', y, q: 1–4 }     … or a quarter
     steps:   [{ id, text, done }]               the checklist → progress
     docs:    [{ id, kind: 'file', fileId } | { id, kind: 'url', url, label }] }
============================================================ */
export const HORIZONS = [
  { id: 'now', label: 'Now' },
  { id: 'next', label: 'Next' },
  { id: 'later', label: 'Later' }
];
export const STATUSES = [
  { id: 'ontrack', label: 'On track', color: '#22A06B', ink: '#FFFFFF' },
  { id: 'atrisk', label: 'At risk', color: '#E2B203', ink: '#1F1A05' },
  { id: 'offtrack', label: 'Off track', color: '#E2483D', ink: '#FFFFFF' },
  { id: 'pending', label: 'Pending', color: '#5B6B86', ink: '#FFFFFF' },
  { id: 'done', label: 'Done', color: '#1D7AFC', ink: '#FFFFFF' }
];
export const statusOf = it => STATUSES.find(s => s.id === it.status) || STATUSES[3];
export const horizonOf = it => HORIZONS.find(h => h.id === it.horizon) || HORIZONS[0];
export const goalOf = (p, it) => (it.goalId && (p.goals || []).find(g => g.id === it.goalId)) || null;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const isoOf = n => new Date(n * 86400000).toISOString().slice(0, 10);
export const today = () => dayNumber(isoDate(new Date()));

/* [first day, last day] (day numbers, inclusive) */
export function itemRange(w){
  if (w.kind === 'month'){
    const [y, m] = w.ym.split('-').map(Number);
    return [dayNumber(w.ym + '-01'), dayNumber(w.ym + '-' + pad(daysInMonth(y, m - 1)))];
  }
  if (w.kind === 'quarter'){
    const m0 = (w.q - 1) * 3;
    return [dayNumber(w.y + '-' + pad(m0 + 1) + '-01'), dayNumber(w.y + '-' + pad(m0 + 3) + '-' + pad(daysInMonth(w.y, m0 + 2)))];
  }
  return [dayNumber(w.date), dayNumber(w.end || w.date)];
}

const ddmm = iso => iso.slice(8, 10) + '.' + iso.slice(5, 7);
const ddmmyy = iso => ddmm(iso) + '.' + iso.slice(2, 4);
/* "13.12.26", "20.11 – 05.12.26", "Nov 2026", "Apr–Jun 2027" */
export function whenLabel(w){
  if (w.kind === 'month') return MONTHS[+w.ym.slice(5, 7) - 1] + ' ' + w.ym.slice(0, 4);
  if (w.kind === 'quarter'){ const m0 = (w.q - 1) * 3; return MONTHS[m0] + '–' + MONTHS[m0 + 2] + ' ' + w.y; }
  return w.end ? ddmm(w.date) + ' – ' + ddmmyy(w.end) : ddmmyy(w.date);
}
export const shortWhen = w => w.kind === 'day' ? (w.end ? ddmm(w.date) + '–' + ddmm(w.end) : ddmm(w.date)) : whenLabel(w);

/* the same `when`, moved by `days` — a month / quarter snaps to the one it lands in */
export function shiftWhen(w, days){
  if (w.kind === 'day') return { kind: 'day', date: isoOf(dayNumber(w.date) + days), end: w.end ? isoOf(dayNumber(w.end) + days) : null };
  const [a, b] = itemRange(w);
  const iso = isoOf(Math.round((a + b) / 2) + days);
  if (w.kind === 'month') return { kind: 'month', ym: iso.slice(0, 7) };
  return { kind: 'quarter', y: +iso.slice(0, 4), q: Math.floor((+iso.slice(5, 7) - 1) / 3) + 1 };
}
/* the month / quarter a day falls in */
export const monthOf = iso => ({ kind: 'month', ym: iso.slice(0, 7) });
export const quarterOf = iso => ({ kind: 'quarter', y: +iso.slice(0, 4), q: Math.floor((+iso.slice(5, 7) - 1) / 3) + 1 });

export const progressOf = it => {
  const s = it.steps || [];
  return s.length ? { done: s.filter(x => x.done).length, total: s.length } : null;
};

/* where an item without a horizon goes: done / started / overdue → Now,
   starting within ~2 months → Next, the rest → Later */
export function guessHorizon(w, done, t = today()){
  const [a] = itemRange(w);
  if (done || a <= t) return 'now';
  return a <= t + 61 ? 'next' : 'later';
}

/* fill in the fields of an item (also upgrades the first timeline's
   { date, end, done } items); returns true if it changed */
export function normalizeItem(it, t = today()){
  let changed = false;
  if (!it.when){ it.when = { kind: 'day', date: it.date || isoDate(new Date()), end: it.end || null }; changed = true; }
  if (!it.status){ it.status = it.done ? 'done' : 'pending'; changed = true; }
  if (!it.horizon){ it.horizon = guessHorizon(it.when, it.status === 'done', t); changed = true; }
  if ('date' in it || 'end' in it || 'done' in it){ delete it.date; delete it.end; delete it.done; changed = true; }
  if (!it.steps){ it.steps = []; changed = true; }
  if (!it.docs){ it.docs = []; changed = true; }
  if (it.goalId === undefined){ it.goalId = null; changed = true; }
  if (it.order == null){ it.order = 0; changed = true; }
  if (it.desc == null){ it.desc = ''; changed = true; }
  return changed;
}

export const byWhen = (a, b) => itemRange(a.when)[0] - itemRange(b.when)[0] || a.name.localeCompare(b.name);
export const byOrder = (a, b) => (a.order - b.order) || byWhen(a, b);

/* ---- small UI pieces used by every view ---- */
const el = (tag, cls, text) => {
  const x = document.createElement(tag);
  if (cls) x.className = cls;
  if (text != null) x.textContent = text;
  return x;
};
export function statusChip(it){
  const s = statusOf(it);
  const c = el('span', 'rm-status', s.label);
  c.style.background = s.color; c.style.color = s.ink;
  return c;
}
export function horizonChip(it){ return el('span', 'rm-horizon rm-h-' + horizonOf(it).id, horizonOf(it).label); }
export function goalChip(g){
  const c = el('span', 'rm-goal');
  const dot = el('i');
  dot.style.background = g.color;
  c.style.setProperty('--gc', g.color);
  c.append(dot, el('span', null, g.name));
  return c;
}
export function dateChip(it){ return el('span', 'rm-date' + (it.when.kind !== 'day' ? ' rough' : ''), whenLabel(it.when)); }
export function progressBar(it, withText = true){
  const pr = progressOf(it);
  if (!pr) return null;
  const w = el('span', 'rm-progress' + (pr.done === pr.total ? ' full' : ''));
  const bar = el('span', 'rm-prog-bar'), fill = el('i');
  fill.style.width = (pr.done / pr.total * 100) + '%';
  bar.appendChild(fill);
  w.appendChild(bar);
  if (withText) w.appendChild(el('span', 'rm-prog-text', pr.done + '/' + pr.total));
  return w;
}
