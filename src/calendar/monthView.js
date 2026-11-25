import { isoDate, addDays, mondayOf } from '../lib/dates.js';
import { showContextMenu } from '../lib/contextMenu.js';
import { segmentsOn, paintColors } from './events.js';
import { periodsOn, periodTint } from './periods.js';
import { addStickers, layoutStickers } from './reminderStickers.js';
import { openEventEditor } from './eventEditor.js';
import { openPeriodEditor } from './periodEditor.js';
import { openReminderEditor } from './reminderEditor.js';
import { openDayDetails } from './dayDetails.js';

/* ============================================================
   MONTH VIEW — one month at once, Monday first (4–6 week rows).
   A day is its number and a stack of thin pills — its events
   (and time blocks) by start time, in their type → override
   colors — with its reminders as pictogram stickers, placed as
   in the week view: random spots in the cell, clear of the
   number, the pills and each other. No titles or names:
   clicking a day selects it and opens its details window.
   A day with more pills than fit shows as many as it can and
   "+N" for the rest. Periods tint the day's number row.
============================================================ */
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PILL_H = 6, PILL_GAP = 3;        // px, must match .mo-pill in calendar.css

const el = (tag, cls, text) => {
  const x = document.createElement(tag);
  if (cls) x.className = cls;
  if (text != null) x.textContent = text;
  return x;
};

/* draws the month of `monthStart` (the 1st) into monthEl; onSelect(dateStr) on a click */
export function renderMonth(monthEl, monthStart, selectedDate, onSelect){
  monthEl.innerHTML = '';
  const today = isoDate(new Date());
  const first = mondayOf(monthStart);
  const last = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  const weeks = Math.ceil(((last - first) / 86400000 + 1) / 7);
  monthEl.style.setProperty('--weeks', weeks);
  monthEl.classList.toggle('has-selection', !!selectedDate);

  DOW.forEach((d, i) => monthEl.appendChild(el('div', 'mo-dow' + (i >= 5 ? ' weekend' : ''), d)));
  for (let i = 0; i < weeks * 7; i++){
    const d = addDays(first, i);
    const dStr = isoDate(d);
    const cell = el('div', 'mo-cell');
    if (d.getMonth() !== monthStart.getMonth()) cell.classList.add('other');
    if (i % 7 >= 5) cell.classList.add('weekend');
    if (dStr === today) cell.classList.add('today');
    if (dStr < today) cell.classList.add('past');
    if (dStr === selectedDate) cell.classList.add('selected');
    cell.dataset.date = dStr;

    const head = el('div', 'mo-head');
    head.appendChild(el('span', 'mo-num rem-hit', String(d.getDate())));
    const periods = periodsOn(dStr);
    if (periods.length){
      head.classList.add('in-period');
      head.style.background = periodTint(periods);
    }
    const stack = el('div', 'mo-stack');
    /* like the week: ghosts washed away from a period stay hidden */
    segmentsOn(dStr).filter(s => !(s.cancelled && s.cancelled.hideCancelled)).forEach(s => {
      const pill = el('i', 'mo-pill ev rem-hit' + (s.cancelled || s.outside ? ' ghost' : ''));
      paintColors(pill, s.e);
      stack.appendChild(pill);
    });
    cell.append(head, stack);
    addStickers(cell, dStr);
    cell.addEventListener('click', () => { onSelect(dStr); openDayDetails(dStr); });
    monthEl.appendChild(cell);
  }
  fitPills(monthEl);
  layoutStickers(monthEl);
}

/* each day shows as many pills as its cell holds, the last row becoming "+N" */
export function fitPills(monthEl){
  monthEl.querySelectorAll('.mo-stack').forEach(stack => {
    stack.querySelector('.mo-more')?.remove();
    const pills = [...stack.querySelectorAll('.mo-pill')];
    pills.forEach(p => { p.hidden = false; });
    const h = stack.clientHeight;
    if (!h) return;
    const fits = Math.max(1, Math.floor((h + PILL_GAP) / (PILL_H + PILL_GAP)));
    if (pills.length <= fits) return;
    /* the "+N" label takes about two pill rows */
    const keep = Math.max(0, fits - 2);
    pills.slice(keep).forEach(p => { p.hidden = true; });
    stack.appendChild(el('span', 'mo-more rem-hit', '+' + (pills.length - keep)));
  });
}

/* right click on a day: new event / reminder / period from it */
export function monthContextMenu(e){
  const cell = e.target.closest('.mo-cell');
  if (!cell) return;
  e.preventDefault();
  const date = cell.dataset.date;
  showContextMenu(e.clientX, e.clientY, [
    { label: 'Show details', action: () => openDayDetails(date) },
    { label: 'New event', action: () => openEventEditor({ date, start: '12:00', end: '13:00' }) },
    { label: 'New reminder', action: () => openReminderEditor({ date }) },
    { label: 'New period from here', action: () => openPeriodEditor({ start: date, pickEnd: true }) }
  ]);
}
