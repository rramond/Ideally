import { store } from '../lib/storage.js';
import { isoDate, addDays, mondayOf, dayNumber, daysInMonth, toHours, fromHours } from '../lib/dates.js';

/* ============================================================
   Calendar data: events (with recurrence) and event types.
   Event: { id, title, date, start, end, description, typeId,
            recur: { kind, n? } }   — date = first occurrence
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

/* ---- events ---- */
export const getEvent = id => events.find(e => e.id === id);
export function saveEvent(ev){
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

export function eventsOn(dateStr){
  return events.filter(e => occursOn(e, dateStr)).sort((a, b) => a.start.localeCompare(b.start));
}

/* ============================================================
   Time blocks (3c.2): premade events without a date or start.
   Block: { id, title, duration 'HH:MM', description, typeId, recur }
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
