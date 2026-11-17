import { pad, parseIso, isoDate } from '../lib/dates.js';
import { openPopup, closePopup, isPopupOpen } from '../lib/history.js';
import { addCloseX } from '../lib/popups.js';
import { segmentsOn, timeLabel, typeOf, paintColors, periodOf, getEvent, onEventsChange } from './events.js';
import { openEventEditor } from './eventEditor.js';
import { periodsOn, getPeriod, onPeriodsChange } from './periods.js';
import { openPeriodEditor } from './periodEditor.js';

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
onPeriodsChange(() => { if (refresh) refresh(); });

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
  /* 3e: the periods this day belongs to (click one to edit it) */
  const periodRow = el('div', 'dd-periods');
  head.appendChild(periodRow);
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
    periodRow.innerHTML = '';
    periodsOn(dateStr).forEach(p => {
      const chip = el('button', 'dd-period');
      chip.type = 'button';
      chip.title = 'Edit period';
      chip.style.setProperty('--tc', p.color);
      chip.append(el('i'), document.createTextNode(p.name));
      chip.addEventListener('click', () => { const per = getPeriod(p.id); if (per) openPeriodEditor({ period: per }); });
      periodRow.appendChild(chip);
    });
    list.innerHTML = '';
    /* includes events that started the day before and run past midnight;
       3e.1: the ones cancelled by a period come last, under their own heading;
       3g: so do tied events stranded outside their period */
    const segs = segmentsOn(dateStr);
    const live = segs.filter(s => !s.cancelled && !s.outside);
    const cancelled = segs.filter(s => s.cancelled && !s.outside), outside = segs.filter(s => s.outside);
    if (!segs.length){
      list.appendChild(el('p', 'dd-empty', 'Nothing planned for this day.'));
      return;
    }
    if (!live.length) list.appendChild(el('p', 'dd-empty dd-empty-top', 'Nothing planned for this day.'));
    const ghosts = [
      ...(cancelled.length ? [{ heading: 'Cancelled' }, ...cancelled] : []),
      ...(outside.length ? [{ heading: 'Outside its period' }, ...outside] : [])
    ];
    [...live, ...ghosts].forEach(({ e, cont, cancelled: by, outside: out, heading }) => {
      if (heading){ list.appendChild(el('p', 'dd-group', heading)); return; }
      const t = typeOf(e);
      const item = el('button', 'dd-item' + (by || out ? ' cancelled' : ''));
      item.type = 'button';
      paintColors(item, e);   // 3f: type → override gradient when the event has an override
      item.title = by ? 'Cancelled by ' + by.name + '\nClick to edit'
                 : out ? 'Outside ' + out.name + ' — the period no longer covers this day\nClick to edit' : 'Edit event';
      const top = el('div', 'dd-item-top');
      const repeats = e.recur && e.recur.kind !== 'none';
      top.append(
        el('span', 'dd-time', cont ? 'until ' + e.end : timeLabel(e)),
        el('span', 'dd-title', e.title),
        by ? el('span', 'dd-cancelled-by', 'Cancelled by ' + by.name)
          : out ? el('span', 'dd-cancelled-by', 'Outside ' + out.name)
          : el('span', 'dd-type', t.name + (repeats ? ' ↻' : ''))
      );
      /* 3g: the period the event is tied to */
      const tie = periodOf(e);
      if (tie && !out){
        const during = el('span', 'dd-during', '· ' + tie.name);
        during.style.setProperty('--pc', tie.color);
        top.appendChild(during);
      }
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
