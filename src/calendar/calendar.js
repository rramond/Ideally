import { clamp } from '../lib/utils.js';
import { store } from '../lib/storage.js';
import { pad, isoDate, addDays, mondayOf, parseIso, toHours, fromHours } from '../lib/dates.js';
import { toast } from '../lib/toast.js';
import { showContextMenu } from '../lib/contextMenu.js';
import { segmentsOn, timeLabel, typeOf, colorsOf, periodOf, getEvent, deleteEvent, keepEvent, untieEvent, onEventsChange } from './events.js';
import { openEventEditor } from './eventEditor.js';
import { openDayDetails } from './dayDetails.js';
import { periodsOn, periodsBetween, getPeriod, savePeriod, deletePeriod, onPeriodsChange } from './periods.js';
import { openPeriodEditor } from './periodEditor.js';
import { anyPopupOpen } from '../lib/history.js';

/* ============================================================
   CALENDAR — day columns, 1 to 7 at once (EXTRAS 3.bh): a full
   week is Monday first, fewer days are a sliding window starting
   at any day. Each column scrolls through the day's hours on its
   own; 12 hours fill the visible height. Events are tinted with
   their type's color and glow brighter as the date nears.
============================================================ */
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];           // by getDay()
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS_VISIBLE = 12, FIRST_HOUR = 5;
const WHEEL_STEP = 40;                            // wheel/trackpad distance (px) that moves one hour
const weekEl = document.getElementById('week');

let dayCount = clamp(Number(store.get('ideally.calDays', 7)) || 7, 1, 7);   // columns shown, remembered
let weekStart = mondayOf(new Date());             // first shown day (a Monday when 7 days are shown)
const lastShown = () => addDays(weekStart, dayCount - 1);
let hourPx = 0;                                   // height of one hour row
const colScroll = Array(7).fill(FIRST_HOUR);      // per column slot: top visible hour (whole hours), kept when paging
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
/* fill with the type color — or, with an override (3f), a left → right gradient
   from the type color to the override (the left / right borders take each
   color, the glow blends the two). Today's events are FILL_NEAR% solid and
   fade with distance to FILL_FAR% two weeks out (urgency()); the glow fades
   with them. Past events are ghosted (.past: faint, dashed, no glow). */
const FILL_NEAR = 60, FILL_FAR = 14, U_FAR = 0.12;   // U_FAR = urgency() two weeks out
function blockStyle(el, item, u){
  const { type, override } = colorsOf(item);
  const mix = (c, pct) => 'color-mix(in srgb, ' + c + ' ' + Math.round(Math.min(100, pct)) + '%, transparent)';
  const fill = pct => override ? 'linear-gradient(90deg, ' + mix(type, pct) + ', ' + mix(override, pct) + ')' : mix(type, pct);
  const blend = override ? 'color-mix(in srgb, ' + type + ', ' + override + ')' : type;
  const border = pct => {
    el.style.borderColor = mix(blend, pct);
    if (override){ el.style.borderLeftColor = mix(type, pct + 20); el.style.borderRightColor = mix(override, pct + 20); }
  };
  if (u <= 0){
    el.classList.add('past');
    el.style.background = fill(FILL_FAR);
    border(FILL_FAR + 15);
    el.style.color = 'var(--muted)';
    return;
  }
  const t = Math.max(0, (u - U_FAR) / (1 - U_FAR));   // 1 today → 0 two weeks out
  el.style.background = fill(FILL_FAR + (FILL_NEAR - FILL_FAR) * t);
  border(35 + 45 * t);
  el.style.boxShadow = '0 0 ' + (2 + 6 * t) + 'px ' + mix(blend, 15 + 45 * t);
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

/* a full week: "October 2026", "Sep – Oct 2026" or "Dec 2026 – Jan 2027";
   fewer days: "Mon 16 Nov 2026", "16 – 18 Nov 2026", "30 Nov – 2 Dec 2026" */
function weekTitle(){
  const end = lastShown();
  const short = d => MONTHS[d.getMonth()].slice(0, 3);
  if (dayCount === 1) return DAY_FULL[weekStart.getDay()].slice(0, 3) + ' ' + weekStart.getDate() + ' ' + short(weekStart) + ' ' + weekStart.getFullYear();
  if (dayCount < 7){
    if (weekStart.getMonth() === end.getMonth()) return weekStart.getDate() + ' – ' + end.getDate() + ' ' + short(end) + ' ' + end.getFullYear();
    if (weekStart.getFullYear() === end.getFullYear()) return weekStart.getDate() + ' ' + short(weekStart) + ' – ' + end.getDate() + ' ' + short(end) + ' ' + end.getFullYear();
    return weekStart.getDate() + ' ' + short(weekStart) + ' ' + weekStart.getFullYear() + ' – ' + end.getDate() + ' ' + short(end) + ' ' + end.getFullYear();
  }
  if (weekStart.getMonth() === end.getMonth()) return MONTHS[end.getMonth()] + ' ' + end.getFullYear();
  if (weekStart.getFullYear() === end.getFullYear()) return short(weekStart) + ' – ' + short(end) + ' ' + end.getFullYear();
  return short(weekStart) + ' ' + weekStart.getFullYear() + ' – ' + short(end) + ' ' + end.getFullYear();
}

/* ---- how many days: the − / + pill and the 1–7 keys ---- */
const daysLabel = document.getElementById('cal-days-label');
const daysLess = document.getElementById('cal-days-less'), daysMore = document.getElementById('cal-days-more');
function showDayCount(){
  if (document.activeElement !== daysLabel) daysLabel.value = dayCount + (dayCount === 1 ? ' day' : ' days');
  weekEl.classList.toggle('wide', dayCount <= 3);       // 1–3 days: time and title on one line, bigger text
  weekEl.classList.toggle('one-day', dayCount === 1);   // 1 day: the description to the right of the title
  daysLess.disabled = dayCount <= 1;
  daysMore.disabled = dayCount >= 7;
  weekEl.style.setProperty('--days', dayCount);
}
/* the first shown day after a change: the selected date, else today if it is
   in view, else the current first day — snapped to Monday for a full week */
function setDayCount(n){
  n = clamp(n, 1, 7);
  if (n === dayCount) return;
  const today = isoDate(new Date());
  const anchor = selectedDate ? parseIso(selectedDate)
    : isoDate(weekStart) <= today && today <= isoDate(lastShown()) ? parseIso(today) : weekStart;
  dayCount = n;
  store.set('ideally.calDays', n);
  weekStart = n === 7 ? mondayOf(anchor) : anchor;
  renderWeek();
}
daysLess.addEventListener('click', () => setDayCount(dayCount - 1));
daysMore.addEventListener('click', () => setDayCount(dayCount + 1));
/* the label can be typed into: a digit 1–7 applies right away */
daysLabel.addEventListener('focus', () => { daysLabel.value = String(dayCount); daysLabel.select(); });
daysLabel.addEventListener('input', () => {
  const m = daysLabel.value.match(/[1-7]/);
  if (!m) return;
  daysLabel.blur();                                    // blur restores "N days"
  setDayCount(Number(m[0]));
});
daysLabel.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape'){ e.preventDefault(); daysLabel.blur(); } });
daysLabel.addEventListener('blur', showDayCount);
document.addEventListener('keydown', e => {
  if (!/^[1-7]$/.test(e.key) || e.ctrlKey || e.metaKey || e.altKey) return;
  if (!weekEl.offsetParent || anyPopupOpen()) return;                       // calendar not in view, or a pop-up is open
  const t = e.target;
  if (t.closest && (t.closest('input, textarea, select') || t.isContentEditable)) return;
  setDayCount(Number(e.key));
});

function renderWeek(){
  document.getElementById('cal-title').textContent = weekTitle();
  showDayCount();
  weekEl.innerHTML = '';
  renderedToday = isoDate(new Date());
  weekEl.classList.toggle('has-selection', !!selectedDate);
  periodTag.hidden = true;

  /* 3e: periods touching the shown days get a band row each (overlaps stack) */
  const weekPeriods = periodsBetween(isoDate(weekStart), isoDate(lastShown()));
  const laneOf = new Map(), laneEnds = [];
  weekPeriods.forEach(p => {
    let lane = laneEnds.findIndex(end => end < p.start);
    if (lane < 0){ lane = laneEnds.length; laneEnds.push(p.end); } else laneEnds[lane] = p.end;
    laneOf.set(p.id, lane);
  });

  for (let i = 0; i < dayCount; i++){
    const d = addDays(weekStart, i);
    const dStr = isoDate(d);
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    const col = document.createElement('div');
    col.className = 'day-col' + (dStr === renderedToday ? ' today' : '') + (weekend ? ' weekend' : '') + (dStr === selectedDate ? ' selected' : '');
    col.dataset.date = dStr;
    col.dataset.index = i;

    /* daysRow cell: dim weekday initial (the full name when 4 or fewer days are shown) above the bold DD.MM */
    const head = document.createElement('div');
    head.className = 'day-head';
    const init = document.createElement('span');
    init.className = 'dh-init';
    init.textContent = dayCount <= 4 ? DAY_FULL[d.getDay()] : DAY_INITIALS[d.getDay()];
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
    /* ghosts washed away from a period (hideCancelled) are left out until "Show cancelled events" */
    const segs = segmentsOn(dStr).filter(s => !(s.cancelled && s.cancelled.hideCancelled));
    layoutDay(segs).forEach(({ e, start, end, lane, lanes, cont, cancelled, outside }) => {
      const block = document.createElement('div');
      /* an overnight event: .to-next on its first day, .cont where it continues;
         3e.1: one cancelled by a period is ghosted; 3g: so is a tied event whose
         period no longer covers its start day */
      block.className = 'ev-block' + (cont ? ' cont' : end >= 24 && e.end !== '24:00' ? ' to-next' : '') +
                        (cancelled ? ' cancelled' : '') + (outside ? ' outside' : '');
      if (cancelled) block.dataset.cancelledBy = cancelled.name;
      if (outside) block.dataset.outside = outside.name;
      block.dataset.id = e.id;
      block.style.top = atHour(start);
      block.style.height = 'calc(var(--hour, 40px) * ' + (end - start) + ' - 3px)';
      block.style.setProperty('--lane', lane);
      block.style.setProperty('--lanes', lanes);
      const repeats = e.recur && e.recur.kind !== 'none';
      const t = document.createElement('span');
      t.className = 'ev-time';
      t.textContent = timeLabel(e) + (repeats ? ' ↻' : '');
      /* 3g: a tied event carries a dot in its period's color */
      const tie = periodOf(e);
      if (tie){
        block.classList.add('tied');
        block.style.setProperty('--pc', tie.color);
        const dot = document.createElement('i');
        dot.className = 'ev-period-dot';
        t.prepend(dot);
      }
      const ti = document.createElement('span');
      ti.className = 'ev-title';
      ti.textContent = e.title;
      /* the description is shown inside the block in the 1-day view (CSS) */
      const de = document.createElement('span');
      de.className = 'ev-desc';
      de.textContent = e.description || '';
      block.title = (outside ? 'Outside ' + outside.name + ' — the period no longer covers this day (right-click to untie)\n'
                     : cancelled ? 'Cancelled by ' + cancelled.name + '\nClick to wash the cancelled events out of ' + cancelled.name + ' (right-click to edit)\n' : '') +
                    timeLabel(e) + ' ' + e.title + ' (' + typeOf(e).name + ')' + (tie ? '\nDuring ' + tie.name : '') + (e.description ? '\n' + e.description : '');
      block.append(t, ti);
      if (e.description) block.appendChild(de);
      blockStyle(block, e, u);
      /* a cancelled ghost: clicking washes every ghost of its period away (edit via right-click) */
      block.addEventListener('click', () => cancelled && !outside ? washPeriod(cancelled) : openEventEditor({ event: getEvent(e.id) }));
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

/* clicking a ghost: a wave in the period's color rolls down from its date bar
   through the period's columns (only those), the ghosts fading as it passes;
   then the period remembers to keep them hidden (hideCancelled) */
const WAVE_MS = 1800;
let washing = false;
function washPeriod(p){
  if (washing) return;
  washing = true;
  const cols = [...weekEl.querySelectorAll('.day-col')].filter(c => p.start <= c.dataset.date && c.dataset.date <= p.end);
  if (!cols.length){ washing = false; return; }
  /* one wave spanning the period's columns, laid over the week */
  const weekR = weekEl.getBoundingClientRect();
  const first = cols[0].getBoundingClientRect(), last = cols[cols.length - 1].getBoundingClientRect();
  const wave = document.createElement('div');
  wave.className = 'period-wave';
  wave.style.left = (first.left - weekR.left) + 'px';
  wave.style.width = (last.right - first.left) + 'px';
  wave.style.setProperty('--pc', p.color);
  wave.style.setProperty('--dur', WAVE_MS + 'ms');
  weekEl.appendChild(wave);
  cols.forEach(col => {
    col.querySelectorAll('.ev-block.cancelled').forEach(b => {
      if (b.dataset.cancelledBy !== p.name) return;
      /* each ghost fades when the wave's crest reaches it (the crest covers the column in ~70% of the run) */
      const frac = clamp((b.getBoundingClientRect().top - weekR.top) / weekR.height, 0, 1);
      b.style.animationDelay = Math.round(frac * WAVE_MS * 0.7) + 'ms';
      b.classList.add('washed');
    });
  });
  setTimeout(() => {
    washing = false;
    const cur = getPeriod(p.id);
    if (cur) savePeriod({ ...cur, hideCancelled: true });   // re-renders without the ghosts
    toast('Cancelled events hidden in “' + p.name + '” — right-click its band to show them again');
  }, WAVE_MS + 150);
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
    ...(p.cancelEvents && p.hideCancelled ? [{ label: 'Show cancelled events' + suffix,
      action: () => { const cur = getPeriod(p.id); if (cur){ delete cur.hideCancelled; savePeriod({ ...cur }); } } }] : []),
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

/* jump to dateStr: its week, or a window starting on it (Periods list → "Show in calendar") */
export function showWeekOf(dateStr){
  selectedDate = null;
  const d = parseIso(dateStr);
  weekStart = dayCount === 7 ? mondayOf(d) : d;
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
    const items = [
      { label: 'Edit event', action: () => openEventEditor({ event: getEvent(ev.id) }) }
    ];
    /* 3e.1: a cancelled event can be kept after all (it then counts as made now) */
    if (block.dataset.cancelledBy) items.push({
      label: 'Keep event (cancelled by ' + block.dataset.cancelledBy + ')',
      action: () => { keepEvent(ev.id); toast('“' + ev.title + '” is back on'); }
    });
    /* 3g: a tied event — or one stranded outside its period — can be untied */
    if (ev.periodId) items.push({
      label: 'Untie from “' + (periodOf(ev) ? periodOf(ev).name : 'its period') + '”' + (block.dataset.outside ? ' (outside it)' : ''),
      action: () => { untieEvent(ev.id); toast('“' + ev.title + '” now happens any time'); }
    });
    items.push({ label: repeats ? 'Delete event (all repeats)' : 'Delete event', danger: true,
      action: () => { deleteEvent(ev.id); toast('Deleted “' + ev.title + '”'); } });
    showContextMenu(e.clientX, e.clientY, items);
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

/* ‹ › page by the number of days shown; Today shows this week, or starts the window on today */
document.getElementById('cal-prev').addEventListener('click', () => {
  selectedDate = null;
  weekStart = addDays(weekStart, -dayCount);
  renderWeek();
});
document.getElementById('cal-next').addEventListener('click', () => {
  selectedDate = null;
  weekStart = addDays(weekStart, dayCount);
  renderWeek();
});
document.getElementById('cal-today').addEventListener('click', () => {
  selectedDate = null;
  const today = new Date();
  weekStart = dayCount === 7 ? mondayOf(today) : new Date(today.getFullYear(), today.getMonth(), today.getDate());
  renderWeek();
});
onEventsChange(renderWeek);
onPeriodsChange(renderWeek);
renderWeek();
