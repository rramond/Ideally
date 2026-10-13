import { store } from './lib/storage.js';
import { clamp } from './lib/utils.js';

/* ============================================================
   CALENDAR — week view: one column per day, Monday first.
   Events glow violet, brighter as the date nears.
============================================================ */
const events = store.get('ideally.events', []);
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const weekEl = document.getElementById('week');

let weekStart = mondayOf(new Date());

const pad = n => String(n).padStart(2, '0');
function isoDate(d){ return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()); }
function addDays(d, n){ return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
function mondayOf(d){ return addDays(d, -((d.getDay() + 6) % 7)); }

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
  el.style.boxShadow = '0 0 ' + (3 + 11 * u) + 'px rgba(177,76,248,' + (0.2 + 0.6 * u) + ')';
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
  const todayStr = isoDate(new Date());

  for (let i = 0; i < 7; i++){
    const d = addDays(weekStart, i);
    const dStr = isoDate(d);
    const col = document.createElement('div');
    col.className = 'day-col' + (dStr === todayStr ? ' today' : '') + (i >= 5 ? ' weekend' : '');

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

    const body = document.createElement('div');
    body.className = 'day-body';
    const u = urgency(dStr);
    eventsOn(dStr).forEach(e => {
      const chip = document.createElement('span');
      chip.className = 'ev-chip';
      chip.textContent = (e.time ? e.time + ' ' : '') + e.title;
      chip.title = chip.textContent;
      glowStyle(chip, u);
      body.appendChild(chip);
    });

    col.append(head, body);
    weekEl.appendChild(col);
  }
}

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
