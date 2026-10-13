import { store } from './lib/storage.js';
import { clamp } from './lib/utils.js';

/* ============================================================
   CALENDAR — week view: one column per day, Monday first.
   Each column scrolls through the day's hours on its own;
   12 hours fill the visible height. Events glow violet,
   brighter as the date nears.
============================================================ */
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const HOURS_VISIBLE = 12, FIRST_HOUR = 5;
const weekEl = document.getElementById('week');

const pad = n => String(n).padStart(2, '0');
function isoDate(d){ return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()); }
function addDays(d, n){ return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
function mondayOf(d){ return addDays(d, -((d.getDay() + 6) % 7)); }

let events = store.get('ideally.events', []);
let weekStart = mondayOf(new Date());
let hourPx = 0;                                   // height of one hour row
const colScroll = Array(7).fill(FIRST_HOUR);      // per weekday: top visible hour (whole hours), kept across weeks
const WHEEL_STEP = 40;                            // wheel/trackpad distance (px) that moves one hour
let calHidden = true;
let renderedToday = isoDate(new Date());

/* One-time: the old events are only placeholders now — move them into the
   current week (same weekday, untimed ones at 12:00), or seed a few. */
if (!store.get('ideally.eventsMovedToWeek', false)){
  const DUMMIES = [[0, '07:00', 'Morning run'], [1, '09:30', 'Dentist'], [2, '14:00', 'Team sync'],
                   [3, '18:00', 'Gym'], [4, '20:00', 'Dinner with friends'], [5, '11:00', 'Groceries']];
  events = events.length
    ? events.map(e => {
        const day = (new Date(e.date + 'T00:00:00').getDay() + 6) % 7;
        return { ...e, date: isoDate(addDays(weekStart, day)), time: e.time || '12:00' };
      })
    : DUMMIES.map(([day, time, title], i) => ({ id: 'dummy' + i, date: isoDate(addDays(weekStart, day)), time, title }));
  store.set('ideally.events', events);
  store.set('ideally.eventsMovedToWeek', true);
}

function eventsOn(dateStr){
  return events.filter(e => e.date === dateStr)
               .sort((a,b) => (a.time||'99:99').localeCompare(b.time||'99:99'));
}
function urgency(dateStr){
  /* 0 → past, 0.12 → far away, 1 → today/tomorrow */
  const now = new Date(); now.setHours(0,0,0,0);
  const d = (new Date(dateStr + 'T00:00:00') - now) / 86400000;
  if (d < 0) return 0;
  return clamp(1 - d / 14, 0.12, 1);
}
function glowStyle(el, u){
  if (u <= 0){
    el.style.background = 'rgba(139,137,160,.10)';
    el.style.color = 'var(--muted)';
    return;
  }
  el.style.background = 'rgba(177,76,248,' + (0.08 + 0.22 * u) + ')';
  el.style.borderColor = 'rgba(192,132,252,' + (0.15 + 0.5 * u) + ')';
  el.style.boxShadow = '0 0 ' + (2 + 6 * u) + 'px rgba(177,76,248,' + (0.15 + 0.4 * u) + ')';
}

const toHours = time => { const [h, m] = time.split(':').map(Number); return h + m / 60; };
const atHour = h => 'calc(var(--hour) * ' + h + ')';

/* side-by-side lanes for events that overlap (each lasts 1 hour for now) */
function layoutDay(evs){
  const out = [];
  let cluster = [], clusterEnd = -1, laneEnds = [];
  const flush = () => { cluster.forEach(o => { o.lanes = laneEnds.length; }); cluster = []; laneEnds = []; };
  evs.forEach(e => {
    const start = toHours(e.time), end = start + 1;
    if (start >= clusterEnd) flush();
    let lane = laneEnds.findIndex(t => t <= start);
    if (lane < 0){ lane = laneEnds.length; laneEnds.push(end); } else laneEnds[lane] = end;
    const o = { e, start, lane };
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

  for (let i = 0; i < 7; i++){
    const d = addDays(weekStart, i);
    const dStr = isoDate(d);
    const col = document.createElement('div');
    col.className = 'day-col' + (dStr === renderedToday ? ' today' : '') + (i >= 5 ? ' weekend' : '');

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
      label.textContent = pad(h) + ':00';
      row.appendChild(label);
      grid.appendChild(row);
    }

    const u = urgency(dStr);
    layoutDay(eventsOn(dStr).filter(e => e.time)).forEach(({ e, start, lane, lanes }) => {
      const block = document.createElement('div');
      block.className = 'ev-block';
      block.style.top = atHour(start);
      block.style.setProperty('--lane', lane);
      block.style.setProperty('--lanes', lanes);
      const t = document.createElement('span'); t.className = 'ev-time'; t.textContent = e.time;
      const ti = document.createElement('span'); ti.className = 'ev-title'; ti.textContent = e.title;
      block.title = e.time + ' ' + e.title;
      block.append(t, ti);
      glowStyle(block, u);
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
    col.append(head, body);
    weekEl.appendChild(col);
  }
  restoreScroll();
  updateNowLine();
}

function restoreScroll(){
  if (!hourPx) return;
  weekEl.querySelectorAll('.day-body').forEach((b, i) => { b.scrollTop = colScroll[i] * hourPx; });
}

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
  weekStart = addDays(weekStart, -7);
  renderWeek();
});
document.getElementById('cal-next').addEventListener('click', () => {
  weekStart = addDays(weekStart, 7);
  renderWeek();
});
document.getElementById('cal-today').addEventListener('click', () => {
  weekStart = mondayOf(new Date());
  renderWeek();
});
renderWeek();
