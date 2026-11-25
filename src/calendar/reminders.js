import { store } from '../lib/storage.js';
import { isoDate } from '../lib/dates.js';

/* ============================================================
   REMINDERS — one-time things that belong to a date but not to
   a time of day (a birthday, an anniversary, a deadline…).
   Reminder: { id, name, date: 'YYYY-MM-DD', description,
               icon: emoji string | null, created }
   icon null = the default pictogram (the red double "!!").
   On the calendar they are stickers on the day's date box.
============================================================ */
let reminders = store.get('ideally.reminders', []);
const listeners = [];
export const onRemindersChange = fn => listeners.push(fn);
function persist(){
  store.set('ideally.reminders', reminders);
  listeners.forEach(fn => fn());
}

/* by date, then by creation, so the stickers keep their places */
const byDate = (a, b) => a.date.localeCompare(b.date) || (a.created || 0) - (b.created || 0) || a.id.localeCompare(b.id);

export const getReminders = () => [...reminders].sort(byDate);
export const getReminder = id => reminders.find(r => r.id === id);
export const remindersOn = dateStr => reminders.filter(r => r.date === dateStr).sort(byDate);
export const isPast = r => r.date < isoDate(new Date());

export function saveReminder(r){
  if (!r.created) r.created = Date.now();
  const i = reminders.findIndex(x => x.id === r.id);
  if (i < 0) reminders.push(r); else reminders[i] = r;
  persist();
}
export function deleteReminder(id){
  reminders = reminders.filter(r => r.id !== id);
  persist();
}
