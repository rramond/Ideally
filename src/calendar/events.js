import { store } from '../lib/storage.js';
import { isoDate, addDays, mondayOf, parseIso, dayNumber, daysInMonth, toHours, fromHours } from '../lib/dates.js';
import { cancelledBy } from './periods.js';
import { colorDistance } from '../lib/oklab.js';
import { farthestColor } from '../lib/palette.js';

/* ============================================================
   Calendar data: events (with recurrence) and event types.
   Event: { id, title, date, start, end, description, typeId,
            recur: { kind, n? }, created, overrideColor? }
   — date = first occurrence, created = when it was made (ms);
   cancelling periods only cancel events made before they
   started cancelling (3e.1). An end earlier than the start
   means the event runs past midnight and ends on the next day
   (22:00–02:00). overrideColor (3f): an optional second color
   that tells the event apart within its type; it is drawn as a
   left → right gradient from the type color to the override.
============================================================ */
export const RECURRENCE = [
  ['none', 'Does not repeat'],
  ['daily', 'Daily'],
  ['everyN', 'Every … days'],
  ['weekly', 'Weekly'],
  ['biweekly', 'Every 2 weeks'],
  ['monthly', 'Monthly']
];

const DEFAULT_TYPES = [
  { id: 'work', name: 'Work', color: '#5BC8FF' },
  { id: 'personal', name: 'Personal', color: '#C084FC' },
  { id: 'health', name: 'Health', color: '#71E69A' },
  { id: 'social', name: 'Social', color: '#FF6FA5' }
];

let types = store.get('ideally.eventTypes', DEFAULT_TYPES);
let events = store.get('ideally.events', []);

const listeners = [];
export const onEventsChange = fn => listeners.push(fn);
const changed = () => listeners.forEach(fn => fn());
const saveEvents = () => store.set('ideally.events', events);
const saveTypes = () => store.set('ideally.eventTypes', types);

/* One-time: the old events are only placeholders now — move them into the
   current week (same weekday, untimed ones at 12:00), or seed a few. */
if (!store.get('ideally.eventsMovedToWeek', false)){
  const weekStart = mondayOf(new Date());
  const DUMMIES = [[0, '07:00', 'Morning run'], [1, '09:30', 'Dentist'], [2, '14:00', 'Team sync'],
                   [3, '18:00', 'Gym'], [4, '20:00', 'Dinner with friends'], [5, '11:00', 'Groceries']];
  events = events.length
    ? events.map(e => {
        const day = (new Date(e.date + 'T00:00:00').getDay() + 6) % 7;
        return { ...e, date: isoDate(addDays(weekStart, day)), time: e.time || '12:00' };
      })
    : DUMMIES.map(([day, time, title], i) => ({ id: 'dummy' + i, date: isoDate(addDays(weekStart, day)), time, title }));
  saveEvents();
  store.set('ideally.eventsMovedToWeek', true);
}

/* old events had only a start `time`: give them an end one hour later, a type, no repeat */
let upgraded = false;
events.forEach(e => {
  if (e.start) return;
  upgraded = true;
  e.start = e.time || '12:00';
  e.end = fromHours(Math.min(24, toHours(e.start) + 1));
  delete e.time;
  e.description = e.description || '';
  e.typeId = e.typeId || 'personal';
  e.recur = e.recur || { kind: 'none' };
});
/* events from before `created` existed count as made long ago: any cancelling period cancels them */
events.forEach(e => { if (e.created == null){ e.created = 0; upgraded = true; } });
if (upgraded) saveEvents();

/* ---- types ---- */
export const getTypes = () => types;
export const typeOf = e => types.find(t => t.id === e.typeId) || types[0];
export function saveType(t){
  const i = types.findIndex(x => x.id === t.id);
  if (i < 0) types.push(t); else types[i] = t;
  saveTypes(); changed();
}
export function deleteType(id){
  if (types.length < 2) return;           // always keep at least one type
  types = types.filter(t => t.id !== id); // its events fall back to the first type
  saveTypes(); changed();
}
/* new events start with the last type used */
export function lastTypeId(){
  const id = store.get('ideally.lastEventType', null);
  return types.some(t => t.id === id) ? id : types[0].id;
}
export const rememberType = id => store.set('ideally.lastEventType', id);

/* ---- 3f: type color override ---- */
/* an override must be clearly different from its type's color — a smaller
   forbidden range than the one periods keep between each other (0.10) */
export const MIN_OVERRIDE_DISTANCE = 0.07;
export const overrideClash = (hex, typeColor) => colorDistance(hex, typeColor) < MIN_OVERRIDE_DISTANCE;
/* the first override to offer: as far from the type color as possible */
export const suggestOverride = typeColor => farthestColor([typeColor]);
/* the colors an event or block is drawn with: { type, override | null } */
export const colorsOf = item => ({ type: typeOf(item).color, override: item.overrideColor || null });
/* set --tc (type color) and --tc2 (override, or the type color again) on an
   element, so the CSS can draw the type → override gradient; .overridden marks
   elements that really have two colors */
export function paintColors(el, item){
  const { type, override } = colorsOf(item);
  el.style.setProperty('--tc', type);
  el.style.setProperty('--tc2', override || type);
  el.classList.toggle('overridden', !!override);
}

/* ---- events ---- */
export const getEvent = id => events.find(e => e.id === id);
export function saveEvent(ev){
  if (ev.created == null) ev.created = Date.now();
  const i = events.findIndex(e => e.id === ev.id);
  if (i < 0) events.push(ev); else events[i] = ev;
  saveEvents(); changed();
}
export function deleteEvent(id){
  events = events.filter(e => e.id !== id);
  saveEvents(); changed();
}

/* does event e happen on dateStr? */
export function occursOn(e, dateStr){
  const diff = dayNumber(dateStr) - dayNumber(e.date);
  if (diff < 0) return false;
  const r = e.recur || { kind: 'none' };
  switch (r.kind){
    case 'daily':    return true;
    case 'everyN':   return diff % (r.n || 2) === 0;
    case 'weekly':   return diff % 7 === 0;
    case 'biweekly': return diff % 14 === 0;
    case 'monthly': {
      /* same day of the month; the 29th–31st fall on the last day of shorter months */
      const baseDay = Number(e.date.split('-')[2]);
      const [y, m, d] = dateStr.split('-').map(Number);
      return d === Math.min(baseDay, daysInMonth(y, m - 1));
    }
    default:         return diff === 0;
  }
}

/* the events that take place on dateStr — cancelled ones left out (this is what
   a day query should answer); withCancelled: true keeps them */
export function eventsOn(dateStr, { withCancelled = false } = {}){
  return events.filter(e => occursOn(e, dateStr) && (withCancelled || !cancelledBy(e, dateStr)))
               .sort((a, b) => a.start.localeCompare(b.start));
}

/* runs past midnight into the next day? (an end of 24:00 is still the same day) */
export const isOvernight = e => toHours(e.end) < toHours(e.start);
/* "09:00–10:00", or "22:00–02:00 (+1)" for an event ending the next day */
export const timeLabel = e => e.start + '–' + e.end + (isOvernight(e) ? ' (+1)' : '');

/* what fills dateStr's hours: { e, start, end (hours), cont, cancelled }. An
   overnight event gives its first day start→24 and the next day 0→end
   (cont = true). cancelled = the period cancelling it (by its start day), or null. */
export function segmentsOn(dateStr){
  const prev = isoDate(addDays(parseIso(dateStr), -1));
  const segs = [];
  events.forEach(e => {
    const start = toHours(e.start), end = toHours(e.end), over = end < start;
    if (occursOn(e, dateStr)) segs.push({ e, start, end: over ? 24 : end, cont: false, cancelled: cancelledBy(e, dateStr) });
    if (over && end > 0 && occursOn(e, prev)) segs.push({ e, start: 0, end, cont: true, cancelled: cancelledBy(e, prev) });
  });
  return segs.sort((a, b) => a.start - b.start || b.end - a.end);
}

/* the period editor's preview: how many events a (draft) period would cancel
   on its days → { events, repeating }. An unsaved draft has no cancelSince
   yet, so it is treated as switched on right now. */
export function cancelCount(period){
  const p = { ...period, cancelEvents: true, cancelSince: period.cancelSince || Date.now() };
  const hit = new Set();
  for (let d = parseIso(p.start), end = parseIso(p.end); d <= end; d = addDays(d, 1)){
    const iso = isoDate(d);
    events.forEach(e => { if (occursOn(e, iso) && cancelledBy(e, iso, [p])) hit.add(e); });
  }
  return { events: hit.size, repeating: [...hit].filter(e => e.recur && e.recur.kind !== 'none').length };
}

/* a cancelled event the user wants after all: it now counts as made just now,
   so no period that is already cancelling touches it any more */
export function keepEvent(id){
  const e = getEvent(id);
  if (!e) return;
  e.created = Date.now();
  saveEvents(); changed();
}

/* ============================================================
   Time blocks (3c.2): premade events without a date or start.
   Block: { id, title, duration 'HH:MM', description, typeId, recur,
            overrideColor? }   — a dropped block passes its override on
============================================================ */
let blocks = store.get('ideally.timeBlocks', []);
const saveBlocks = () => store.set('ideally.timeBlocks', blocks);

export const getBlocks = () => blocks;
export const getBlock = id => blocks.find(b => b.id === id);
export function saveBlock(b){
  const i = blocks.findIndex(x => x.id === b.id);
  if (i < 0) blocks.push(b); else blocks[i] = b;
  saveBlocks(); changed();
}
export function deleteBlock(id){
  blocks = blocks.filter(b => b.id !== id);
  saveBlocks(); changed();
}
