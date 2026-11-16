import { clamp } from '../lib/utils.js';
import { pad, isoDate, addDays, mondayOf, parseIso, toHours, fromHours } from '../lib/dates.js';
import { toast } from '../lib/toast.js';
import { showContextMenu } from '../lib/contextMenu.js';
import { segmentsOn, timeLabel, typeOf, getEvent, deleteEvent, onEventsChange } from './events.js';
import { openEventEditor } from './eventEditor.js';
import { openDayDetails } from './dayDetails.js';
import { periodsOn, periodsBetween, getPeriod, deletePeriod, onPeriodsChange } from './periods.js';
import { openPeriodEditor } from './periodEditor.js';
import { anyPopupOpen } from '../lib/history.js';

/* ============================================================
   CALENDAR — week view: one column per day, Monday first.
   Each column scrolls through the day's hours on its own;
   12 hours fill the visible height. Events are tinted with
   their type's color and glow brighter as the date nears.
============================================================ */
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const HOURS_VISIBLE = 12, FIRST_HOUR = 5;
const WHEEL_STEP = 40;                            // wheel/trackpad distance (px) that moves one hour
const weekEl = document.getElementById('week');

let weekStart = mondayOf(new Date());
let hourPx = 0;                                   // height of one hour row
const colScroll = Array(7).fill(FIRST_HOUR);      // per weekday: top visible hour (whole hours), kept across weeks
let calHidden = true;
let renderedToday = isoDate(new Date());
let selectedDate = null;                          // 3d: clicked date, the others are dimmed
let suppressHeadClick = false;                    // a header drag (new period) just ended on a header

function urgency(dateStr){
  /* 0 → past, 0.12 → far away, 1 → today/tomorrow */
  const now = new Date(); now.setHours(0,0,0,0);
  const d = (new Date(dateStr + 'T00:00:00') - now) / 86400000;
  if (d < 0) return 0;
  return clamp(1 - d / 14, 0.12, 1);
}
/* tint with the type color; the glow grows as the date nears, past events are dim */
function blockStyle(el, color, u){
  const mix = pct => 'color-mix(in srgb, ' + color + ' ' + Math.round(pct) + '%, transparent)';
  if (u <= 0){
    el.style.background = mix(9);
    el.style.borderColor = mix(20);
    el.style.color = 'var(--muted)';
    return;
  }
  el.style.background = mix(14 + 18 * u);
  el.style.borderColor = mix(35 + 40 * u);
  el.style.boxShadow = '0 0 ' + (2 + 6 * u) + 'px ' + mix(15 + 40 * u);
}

const atHour = h => 'calc(var(--hour, 40px) * ' + h + ')';

/* side-by-side lanes for events that overlap (segs from segmentsOn, sorted by start) */
function layoutDay(segs){
  const out = [];
  let cluster = [], clusterEnd = -1, laneEnds = [];
  const flush = () => { cluster.forEach(o => { o.lanes = laneEnds.length; }); cluster = []; laneEnds = []; };
  segs.forEach(seg => {
    const start = seg.start;
    const end = Math.max(seg.end, start + 0.25);
    if (start >= clusterEnd) flush();
    let lane = laneEnds.findIndex(t => t <= start);
    if (lane < 0){ lane = laneEnds.length; laneEnds.push(end); } else laneEnds[lane] = end;
    const o = { ...seg, start, end, lane };
    cluster.push(o); out.push(o);
    clusterEnd = Math.max(clusterEnd, end);
  });
  flush();
  return out;
}

/* "October 2026", "Sep – Oct 2026" or "Dec 2026 – Jan 2027" */
function weekTitle(){
  const end = addDays(weekStart, 6);
  const short = d => MONTHS[d.getMonth()].slice(0, 3);
  if (weekStart.getMonth() === end.getMonth()) return MONTHS[end.getMonth()] + ' ' + end.getFullYear();
  if (weekStart.getFullYear() === end.getFullYear()) return short(weekStart) + ' – ' + short(end) + ' ' + end.getFullYear();
  return short(weekStart) + ' ' + weekStart.getFullYear() + ' – ' + short(end) + ' ' + end.getFullYear();
}

function renderWeek(){
  document.getElementById('cal-title').textContent = weekTitle();
  weekEl.innerHTML = '';
  renderedToday = isoDate(new Date());
  weekEl.classList.toggle('has-selection', !!selectedDate);
  periodTag.hidden = true;

  /* 3e: periods touching this week get a band row each (overlaps stack) */
  const weekPeriods = periodsBetween(isoDate(weekStart), isoDate(addDays(weekStart, 6)));
  const laneOf = new Map(), laneEnds = [];
  weekPeriods.forEach(p => {
    let lane = laneEnds.findIndex(end => end < p.start);
    if (lane < 0){ lane = laneEnds.length; laneEnds.push(p.end); } else laneEnds[lane] = p.end;
    laneOf.set(p.id, lane);
  });

  for (let i = 0; i < 7; i++){
    const d = addDays(weekStart, i);
    const dStr = isoDate(d);
    const col = document.createElement('div');
    col.className = 'day-col' + (dStr === renderedToday ? ' today' : '') + (i >= 5 ? ' weekend' : '') + (dStr === selectedDate ? ' selected' : '');
    col.dataset.date = dStr;
    col.dataset.index = i;

    /* daysRow cell: dim weekday initial above the bold DD.MM */
    const head = document.createElement('div');
    head.className = 'day-head';
    const init = document.createElement('span');
    init.className = 'dh-init';
    init.textContent = DAY_INITIALS[i];
    const date = document.createElement('span');
    date.className = 'dh-date';
    date.textContent = pad(d.getDate()) + '.' + pad(d.getMonth() + 1);
    head.append(init, date);
    /* 3e: the header is tinted with the day's period colors (stripes if several);
       the period names show in a tag on hover instead of a tooltip */
    const dayPeriods = periodsOn(dStr);
    if (dayPeriods.length){
      head.classList.add('in-period');
      head.style.background = periodTint(dayPeriods);
    } else {
      head.title = 'Click to select · double-click for the day’s details · drag across days for a period';
    }
    /* click selects the date (again: unselects); double-click opens its details */
    head.addEventListener('click', e => {
      if (suppressHeadClick){ suppressHeadClick = false; return; }
      if (e.detail > 1) return;              // 2nd click of a double-click: keep it selected
      selectDate(selectedDate === dStr ? null : dStr);
    });
    head.addEventListener('dblclick', () => {
      selectDate(dStr);
      openDayDetails(dStr);
    });

    /* scrollable hours */
    const body = document.createElement('div');
    body.className = 'day-body';
    const grid = document.createElement('div');
    grid.className = 'day-grid';
    for (let h = 0; h < 24; h++){
      const row = document.createElement('div');
      row.className = 'hour-row';
      const label = document.createElement('span');
      label.className = 'hour-label';
      label.textContent = pad(h);
      row.appendChild(label);
      grid.appendChild(row);
    }

    const u = urgency(dStr);
    layoutDay(segmentsOn(dStr)).forEach(({ e, start, end, lane, lanes, cont }) => {
      const block = document.createElement('div');
      /* an overnight event: .to-next on its first day, .cont where it continues */
      block.className = 'ev-block' + (cont ? ' cont' : end >= 24 && e.end !== '24:00' ? ' to-next' : '');
      block.dataset.id = e.id;
      block.style.top = atHour(start);
      block.style.height = 'calc(var(--hour, 40px) * ' + (end - start) + ' - 3px)';
      block.style.setProperty('--lane', lane);
      block.style.setProperty('--lanes', lanes);
      const repeats = e.recur && e.recur.kind !== 'none';
      const t = document.createElement('span');
      t.className = 'ev-time';
      t.textContent = timeLabel(e) + (repeats ? ' ↻' : '');
      const ti = document.createElement('span');
      ti.className = 'ev-title';
      ti.textContent = e.title;
      block.title = timeLabel(e) + ' ' + e.title + ' (' + typeOf(e).name + ')' + (e.description ? '\n' + e.description : '');
      block.append(t, ti);
      blockStyle(block, typeOf(e).color, u);
      block.addEventListener('click', () => openEventEditor({ event: getEvent(e.id) }));
      grid.appendChild(block);
    });

    if (dStr === renderedToday){
      const now = document.createElement('div');
      now.className = 'now-line';
      grid.appendChild(now);
    }

    body.appendChild(grid);
    /* scroll hour by hour: one wheel notch (or a trackpad swipe adding up
       to WHEEL_STEP) moves the column exactly one hour */
    let wheelAcc = 0, wheelIdle = null;
    body.addEventListener('wheel', e => {
      e.preventDefault();
      if (!hourPx) return;
      wheelAcc += e.deltaY * (e.deltaMode === 1 ? 16 : 1);   // lines → px
      clearTimeout(wheelIdle);
      wheelIdle = setTimeout(() => { wheelAcc = 0; }, 200);
      if (Math.abs(wheelAcc) < WHEEL_STEP) return;
      const dir = Math.sign(wheelAcc);
      wheelAcc = 0;
      colScroll[i] = clamp(colScroll[i] + dir, 0, 24 - HOURS_VISIBLE);
      body.scrollTo({ top: colScroll[i] * hourPx, behavior: 'smooth' });
    }, { passive: false });
    if (laneEnds.length){
      /* the periods' color bands above the header, one row per lane */
      const bands = document.createElement('div');
      bands.className = 'day-bands';
      for (let l = 0; l < laneEnds.length; l++){
        const slot = document.createElement('div');
        slot.className = 'pb-slot';
        const p = weekPeriods.find(x => laneOf.get(x.id) === l && x.start <= dStr && dStr <= x.end);
        if (p){
          slot.classList.add('period-band');
          if (dStr === p.start) slot.classList.add('starts');
          if (dStr === p.end) slot.classList.add('ends');
          slot.style.setProperty('--pc', p.color);
          slot.dataset.periodId = p.id;
          slot.addEventListener('click', () => openPeriodEditor({ period: getPeriod(p.id) }));
        }
        bands.appendChild(slot);
      }
      col.appendChild(bands);
    }
    col.append(head, body);
    weekEl.appendChild(col);
  }
  restoreScroll();
  updateNowLine();
}

/* the half-hour slot under the cursor, for dropping a time block of `dur`
   hours: { date, hour, grid } or null when not over a day's hours.
   The block snaps to hour / half-hour rows and always ends by 24:00. */
export function slotAt(x, y, dur){
  const target = document.elementFromPoint(x, y);
  const body = target && target.closest('#week .day-body');
  if (!body || !hourPx) return null;
  const grid = body.querySelector('.day-grid');
  const h = Math.floor((y - grid.getBoundingClientRect().top) / hourPx * 2) / 2;
  const latest = Math.max(0, Math.floor((24 - dur) * 2) / 2);
  return { date: body.parentElement.dataset.date, hour: clamp(h, 0, latest), grid };
}

/* header / band background: the period color, or equal stripes of several */
function periodTint(list){
  const tint = c => 'color-mix(in srgb, ' + c + ' 26%, transparent)';
  if (list.length === 1) return tint(list[0].color);
  const n = list.length;
  return 'linear-gradient(90deg,' + list.map((p, k) =>
    tint(p.color) + ' ' + (k * 100 / n) + '% ' + ((k + 1) * 100 / n) + '%').join(',') + ')';
}

function periodMenuItems(p, named){
  const suffix = named ? ' “' + p.name + '”' : '';
  return [
    { label: 'Edit period' + suffix, action: () => openPeriodEditor({ period: getPeriod(p.id) }) },
    { label: 'Delete period' + suffix, danger: true,
      action: () => { deletePeriod(p.id); toast('Deleted period “' + p.name + '”'); } }
  ];
}

/* hovering a header or band: a small tag with the period color(s) and name(s) */
const periodTag = document.createElement('div');
periodTag.className = 'period-tag';
periodTag.hidden = true;
document.body.appendChild(periodTag);
weekEl.addEventListener('mouseover', e => {
  const band = e.target.closest('.period-band');
  const head = e.target.closest('.day-head');
  const list = (band ? [getPeriod(band.dataset.periodId)] : head ? periodsOn(head.parentElement.dataset.date) : [])
    .filter(Boolean);
  if (!list.length || hdrDrag){ periodTag.hidden = true; return; }
  periodTag.innerHTML = '';
  list.forEach(p => {
    const row = document.createElement('div');
    row.className = 'pt-row';
    const dot = document.createElement('i');
    dot.style.background = p.color;
    dot.style.setProperty('--pc', p.color);
    row.append(dot, document.createTextNode(p.name));
    periodTag.appendChild(row);
  });
  periodTag.hidden = false;
  const r = (band || head).getBoundingClientRect();
  const headBottom = (band || head).closest('.day-col').querySelector('.day-head').getBoundingClientRect().bottom;
  periodTag.style.left = clamp(r.left + r.width / 2 - periodTag.offsetWidth / 2, 8, innerWidth - periodTag.offsetWidth - 8) + 'px';
  periodTag.style.top = (headBottom + 6) + 'px';
});
weekEl.addEventListener('mouseleave', () => { periodTag.hidden = true; });

/* press on a day's header and drag across other days: a new period over them */
let hdrDrag = null;   // { from, to }
weekEl.addEventListener('pointerdown', e => {
  suppressHeadClick = false;     // a drag that ended off its own header leaves no click to swallow
  if (e.button !== 0 || !e.target.closest('.day-head')) return;
  hdrDrag = { from: e.target.closest('.day-col').dataset.date, to: null };
});
document.addEventListener('pointermove', e => {
  if (!hdrDrag) return;
  const col = document.elementFromPoint(e.clientX, e.clientY)?.closest('#week .day-col');
  if (!col || (col.dataset.date === hdrDrag.from && !hdrDrag.to)) return;
  hdrDrag.to = col.dataset.date;
  periodTag.hidden = true;
  const [lo, hi] = hdrDrag.from <= hdrDrag.to ? [hdrDrag.from, hdrDrag.to] : [hdrDrag.to, hdrDrag.from];
  weekEl.querySelectorAll('.day-col').forEach(c =>
    c.classList.toggle('period-drag', lo <= c.dataset.date && c.dataset.date <= hi));
});
document.addEventListener('pointerup', e => {
  if (!hdrDrag) return;
  const { from, to } = hdrDrag;
  hdrDrag = null;
  weekEl.querySelectorAll('.period-drag').forEach(c => c.classList.remove('period-drag'));
  if (!to) return;
  if (e.target.closest && e.target.closest('.day-head')) suppressHeadClick = true;   // released on a header: no date selection
  openPeriodEditor({ start: from <= to ? from : to, end: from <= to ? to : from });
});

/* jump to the week containing dateStr (Periods list → "Show in calendar") */
export function showWeekOf(dateStr){
  selectedDate = null;
  weekStart = mondayOf(parseIso(dateStr));
  renderWeek();
}

function selectDate(dStr){
  selectedDate = dStr;
  weekEl.classList.toggle('has-selection', !!dStr);
  weekEl.querySelectorAll('.day-col').forEach(c => c.classList.toggle('selected', c.dataset.date === dStr));
}
/* Esc unselects (once no pop-up is left to close) */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && selectedDate && !anyPopupOpen() && weekEl.offsetParent) selectDate(null);
});

function restoreScroll(){
  if (!hourPx) return;
  weekEl.querySelectorAll('.day-body').forEach((b, i) => { b.scrollTop = colScroll[i] * hourPx; });
}

/* right click: "New event" on a column (starting at the half hour under the
   cursor), "Edit" / "Delete" on an event */
weekEl.addEventListener('contextmenu', e => {
  const col = e.target.closest('.day-col');
  if (!col) return;
  e.preventDefault();
  const block = e.target.closest('.ev-block');
  if (block){
    const ev = getEvent(block.dataset.id);
    if (!ev) return;
    const repeats = ev.recur && ev.recur.kind !== 'none';
    showContextMenu(e.clientX, e.clientY, [
      { label: 'Edit event', action: () => openEventEditor({ event: getEvent(ev.id) }) },
      { label: repeats ? 'Delete event (all repeats)' : 'Delete event', danger: true,
        action: () => { deleteEvent(ev.id); toast('Deleted “' + ev.title + '”'); } }
    ]);
    return;
  }
  const band = e.target.closest('.period-band');
  if (band){
    const p = getPeriod(band.dataset.periodId);
    if (p) showContextMenu(e.clientX, e.clientY, periodMenuItems(p));
    return;
  }
  if (e.target.closest('.day-head, .day-bands')){
    /* header: a new event at the top visible hour, a new period from this day,
       and the periods this day belongs to */
    const h0 = colScroll[col.dataset.index];
    const items = [
      { label: 'New event', action: () => openEventEditor({ date: col.dataset.date, start: fromHours(h0), end: fromHours(Math.min(24, h0 + 1)) }) },
      { label: 'New period from here', action: () => openPeriodEditor({ start: col.dataset.date, pickEnd: true }) }
    ];
    periodsOn(col.dataset.date).forEach(p => items.push(...periodMenuItems(p, true)));
    showContextMenu(e.clientX, e.clientY, items);
    return;
  }
  let h = colScroll[col.dataset.index];             // on the daysRow: the top visible hour
  const grid = col.querySelector('.day-grid');
  if (hourPx && e.target.closest('.day-body')){
    h = Math.floor((e.clientY - grid.getBoundingClientRect().top) / hourPx * 2) / 2;
  }
  h = clamp(h, 0, 23.5);
  showContextMenu(e.clientX, e.clientY, [
    { label: 'New event', action: () => openEventEditor({ date: col.dataset.date, start: fromHours(h), end: fromHours(Math.min(24, h + 1)) }) }
  ]);
});

/* rows are sized so 12 hours fill a column; recompute whenever the calendar
   becomes visible or the window changes size. Hidden = another tab is open;
   coming back to the calendar starts every column at 05:00 again. */
new ResizeObserver(() => {
  const body = weekEl.querySelector('.day-body');
  const h = body ? body.clientHeight / HOURS_VISIBLE : 0;
  if (!h){ calHidden = true; return; }
  if (calHidden){ calHidden = false; colScroll.fill(FIRST_HOUR); }
  if (h !== hourPx){
    hourPx = h;
    weekEl.style.setProperty('--hour', h + 'px');
  }
  restoreScroll();
}).observe(weekEl);

function updateNowLine(){
  const line = weekEl.querySelector('.now-line');
  if (!line) return;
  const n = new Date();
  line.style.top = atHour(n.getHours() + n.getMinutes() / 60);
}
setInterval(() => {
  if (isoDate(new Date()) !== renderedToday) renderWeek();   // past midnight: move "today"
  else updateNowLine();
}, 30000);

document.getElementById('cal-prev').addEventListener('click', () => {
  selectedDate = null;
  weekStart = addDays(weekStart, -7);
  renderWeek();
});
document.getElementById('cal-next').addEventListener('click', () => {
  selectedDate = null;
  weekStart = addDays(weekStart, 7);
  renderWeek();
});
document.getElementById('cal-today').addEventListener('click', () => {
  selectedDate = null;
  weekStart = mondayOf(new Date());
  renderWeek();
});
onEventsChange(renderWeek);
onPeriodsChange(renderWeek);
renderWeek();
