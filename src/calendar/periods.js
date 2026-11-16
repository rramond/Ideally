import { store } from '../lib/storage.js';
import { isoDate, addDays, parseIso, dayNumber } from '../lib/dates.js';
import { hexToOklab, colorDistance } from '../lib/oklab.js';
import { hsvToHex } from '../colorWheel.js';

/* ============================================================
   PERIODS (3e) — a named span of days (start → end, both
   included) with its own color. Only the color shows on the
   calendar; the name is the period's label.

   Backend indexes, rebuilt on every change (for the planned
   Discord queries):
   - ideally.dayLabels:    { 'YYYY-MM-DD': ['Exams', …] }
                           every covered day → its periods' names
   - ideally.periodColors: [{ name, color, oklab: [L, a, b], cancelEvents }]
                           the colors in use
   Rules: names are unique (case-insensitive); colors must be
   clearly different (OKLab distance ≥ MIN_COLOR_DISTANCE).

   Cancelling (3e.1): a period with cancelEvents cancels the
   events on its days that existed before it started cancelling
   (event.created < period.cancelSince). Nothing is deleted —
   a repeating event just skips those days and goes on after
   the period; events made later, during the period, stay.
============================================================ */
export const MIN_COLOR_DISTANCE = 0.10;

let periods = store.get('ideally.periods', []);
const listeners = [];
export const onPeriodsChange = fn => listeners.push(fn);

function writeIndexes(){
  const labels = {};
  periods.forEach(p => {
    for (let d = parseIso(p.start), end = parseIso(p.end); d <= end; d = addDays(d, 1)){
      const key = isoDate(d);
      (labels[key] = labels[key] || []).push(p.name);
    }
  });
  store.set('ideally.dayLabels', labels);
  store.set('ideally.periodColors', periods.map(p => ({
    name: p.name, color: p.color, oklab: hexToOklab(p.color).map(v => +v.toFixed(4)), cancelEvents: !!p.cancelEvents
  })));
}
function persist(){
  store.set('ideally.periods', periods);
  writeIndexes();
  listeners.forEach(fn => fn());
}
writeIndexes();   // keep the indexes in step with the stored periods

const byStart = (a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end) || a.name.localeCompare(b.name);

export const getPeriods = () => [...periods].sort(byStart);
export const getPeriod = id => periods.find(p => p.id === id);
export const periodsOn = dateStr => periods.filter(p => p.start <= dateStr && dateStr <= p.end).sort(byStart);
/* periods touching the days from → to (inclusive) */
export const periodsBetween = (from, to) => periods.filter(p => p.start <= to && p.end >= from).sort(byStart);
/* the backend label(s) of a day */
export const labelsOn = dateStr => store.get('ideally.dayLabels', {})[dateStr] || [];
export const dayCount = p => dayNumber(p.end) - dayNumber(p.start) + 1;

/* the period that cancels event e on dateStr (the day the event starts), or null.
   `among` lets the period editor test an unsaved draft instead of the stored periods. */
export function cancelledBy(e, dateStr, among = periods){
  const created = e.created || 0;
  return among.find(p => p.cancelEvents && p.start <= dateStr && dateStr <= p.end && created < (p.cancelSince || 0)) || null;
}

export function nameTaken(name, exceptId){
  const n = name.trim().toLowerCase();
  return periods.find(p => p.id !== exceptId && p.name.trim().toLowerCase() === n) || null;
}
/* the period whose color is too close to `hex`, if any */
export function colorClash(hex, exceptId){
  let worst = null, worstD = Infinity;
  periods.forEach(p => {
    if (p.id === exceptId) return;
    const d = colorDistance(hex, p.color);
    if (d < MIN_COLOR_DISTANCE && d < worstD){ worst = p; worstD = d; }
  });
  return worst;
}
/* a vivid color as far as possible from every existing period's color */
export function suggestColor(exceptId){
  const used = periods.filter(p => p.id !== exceptId).map(p => p.color);
  if (!used.length) return '#C084FC';
  let best = '#C084FC', bestD = -1;
  for (let h = 0; h < 360; h += 6){
    for (const [s, v] of [[0.6, 0.98], [0.45, 0.85], [0.75, 0.75]]){
      const hex = hsvToHex(h, s, v);
      const d = Math.min(...used.map(u => colorDistance(hex, u)));
      if (d > bestD){ best = hex; bestD = d; }
    }
  }
  return best;
}

export function savePeriod(p){
  /* cancelSince marks when cancelling was switched on; switching it off forgets it */
  if (p.cancelEvents){ if (!p.cancelSince) p.cancelSince = Date.now(); }
  else { delete p.cancelSince; delete p.hideCancelled; }   // hideCancelled: the ghosts were washed away (calendar.js)
  const i = periods.findIndex(x => x.id === p.id);
  if (i < 0) periods.push(p); else periods[i] = p;
  persist();
}
export function deletePeriod(id){
  periods = periods.filter(p => p.id !== id);
  persist();
}
