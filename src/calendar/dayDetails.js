import { pad, parseIso, isoDate } from '../lib/dates.js';
import { openPopup, closePopup, isPopupOpen } from '../lib/history.js';
import { addCloseX } from '../lib/popups.js';
import { eventsOn, typeOf, getEvent, onEventsChange } from './events.js';
import { openEventEditor } from './eventEditor.js';

/* ============================================================
   DETAILS PANEL (3d) — double-click a date: a window in the
   middle of the screen (same w:h ratio as the screen, smaller)
   with the day's DD.MM and a scrollable list of its events and
   their descriptions. Clicking an event opens it for editing.
============================================================ */
const DETAILS = 'day-details';
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

let refresh = null;   // re-renders the open panel when events change
onEventsChange(() => { if (refresh) refresh(); });

const el = (tag, cls, text) => {
  const x = document.createElement(tag);
  if (cls) x.className = cls;
  if (text != null) x.textContent = text;
  return x;
};

export function openDayDetails(dateStr){
  closePopup(DETAILS);
  const overlay = el('div', 'dd-overlay');
  const card = el('div', 'dd-card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');

  const d = parseIso(dateStr);
  const head = el('div', 'dd-head' + (dateStr === isoDate(new Date()) ? ' today' : ''));
  head.append(
    el('span', 'dd-date', pad(d.getDate()) + '.' + pad(d.getMonth() + 1)),
    el('span', 'dd-weekday', WEEKDAYS[d.getDay()] + ' ' + d.getFullYear())
  );
  card.setAttribute('aria-label', 'Events on ' + pad(d.getDate()) + '.' + pad(d.getMonth() + 1));
  const list = el('div', 'dd-list');
  card.append(head, list);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const close = () => closePopup(DETAILS);
  openPopup(DETAILS, () => { overlay.remove(); refresh = null; });
  addCloseX(card, close);
  overlay.addEventListener('pointerdown', e => { if (e.target === overlay) close(); });

  refresh = () => {
    list.innerHTML = '';
    const evs = eventsOn(dateStr);
    if (!evs.length){
      list.appendChild(el('p', 'dd-empty', 'Nothing planned for this day.'));
      return;
    }
    evs.forEach(e => {
      const t = typeOf(e);
      const item = el('button', 'dd-item');
      item.type = 'button';
      item.style.setProperty('--tc', t.color);
      item.title = 'Edit event';
      const top = el('div', 'dd-item-top');
      const repeats = e.recur && e.recur.kind !== 'none';
      top.append(
        el('span', 'dd-time', e.start + '–' + e.end),
        el('span', 'dd-title', e.title),
        el('span', 'dd-type', t.name + (repeats ? ' ↻' : ''))
      );
      item.appendChild(top);
      if (e.description) item.appendChild(el('p', 'dd-desc', e.description));
      item.addEventListener('click', () => {
        const ev = getEvent(e.id);
        if (ev) openEventEditor({ event: ev });   // stacks on top; Back returns here
      });
      list.appendChild(item);
    });
  };
  refresh();
}

export const isDayDetailsOpen = () => isPopupOpen(DETAILS);
