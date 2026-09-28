import { store } from './lib/storage.js';
import { uid, clamp } from './lib/utils.js';

/* ============================================================
   CALENDAR — events glow violet, brighter as the date nears
============================================================ */
let events = store.get('ideally.events', []);
const today = new Date();
let calCursor = new Date(today.getFullYear(), today.getMonth(), 1);
let selectedDate = isoDate(today);

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
function isoDate(d){ return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function saveEvents(){ store.set('ideally.events', events); }
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

function renderCalendar(){
  document.getElementById('cal-month').textContent = MONTHS[calCursor.getMonth()];
  document.getElementById('cal-year').textContent  = calCursor.getFullYear();
  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';

  const first = new Date(calCursor.getFullYear(), calCursor.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);

  const todayStr = isoDate(new Date());
  for (let i = 0; i < 42; i++){
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dStr = isoDate(d);
    const cell = document.createElement('button');
    cell.className = 'cal-cell'
      + (d.getMonth() !== calCursor.getMonth() ? ' other' : '')
      + (dStr === todayStr ? ' today' : '')
      + (dStr === selectedDate ? ' selected' : '');
    const num = document.createElement('span');
    num.className = 'day-num';
    num.textContent = d.getDate();
    cell.appendChild(num);

    const evs = eventsOn(dStr);
    const u = urgency(dStr);
    evs.slice(0,2).forEach(e => {
      const chip = document.createElement('span');
      chip.className = 'ev-chip';
      chip.textContent = (e.time ? e.time + ' ' : '') + e.title;
      glowStyle(chip, u);
      cell.appendChild(chip);
    });
    if (evs.length > 2){
      const more = document.createElement('span');
      more.className = 'ev-more';
      more.textContent = '+' + (evs.length - 2);
      cell.appendChild(more);
    }
    cell.addEventListener('click', () => {
      selectedDate = dStr;
      if (d.getMonth() !== calCursor.getMonth())
        calCursor = new Date(d.getFullYear(), d.getMonth(), 1);
      renderCalendar(); renderCalSide();
    });
    grid.appendChild(cell);
  }
}

function renderCalSide(){
  const side = document.getElementById('cal-side');
  const d = new Date(selectedDate + 'T00:00:00');
  side.innerHTML = '';

  const h = document.createElement('div');
  h.className = 'side-date';
  h.textContent = d.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' });
  side.appendChild(h);
  const sub = document.createElement('div');
  sub.className = 'side-sub';
  sub.textContent = selectedDate;
  side.appendChild(sub);

  const list = document.createElement('div');
  list.className = 'ev-list';
  const evs = eventsOn(selectedDate);
  const u = urgency(selectedDate);
  if (!evs.length){
    const hint = document.createElement('div');
    hint.className = 'side-hint';
    hint.textContent = 'Nothing planned for this day.';
    list.appendChild(hint);
  }
  evs.forEach(e => {
    const row = document.createElement('div');
    row.className = 'ev-row';
    glowStyle(row, u);
    const t = document.createElement('span'); t.className = 'ev-time'; t.textContent = e.time || '—';
    const ti = document.createElement('span'); ti.className = 'ev-title'; ti.textContent = e.title;
    const del = document.createElement('button'); del.className = 'ev-del'; del.title = 'Delete event'; del.textContent = '×';
    del.addEventListener('click', () => {
      events = events.filter(x => x.id !== e.id);
      saveEvents(); renderCalendar(); renderCalSide();
    });
    row.append(t, ti, del);
    list.appendChild(row);
  });
  side.appendChild(list);

  const form = document.createElement('div');
  form.className = 'ev-form';
  const titleIn = document.createElement('input');
  titleIn.placeholder = 'Add an event…';
  const timeIn = document.createElement('input');
  timeIn.type = 'time';
  const addBtn = document.createElement('button');
  addBtn.className = 'primary-btn';
  addBtn.textContent = 'Add event';
  const add = () => {
    const title = titleIn.value.trim();
    if (!title) { titleIn.focus(); return; }
    events.push({ id: uid(), date: selectedDate, title, time: timeIn.value || '' });
    saveEvents();
    titleIn.value = ''; timeIn.value = '';
    renderCalendar(); renderCalSide();
  };
  addBtn.addEventListener('click', add);
  titleIn.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
  form.append(titleIn, timeIn, addBtn);
  side.appendChild(form);
}

document.getElementById('cal-prev').addEventListener('click', () => {
  calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() - 1, 1);
  renderCalendar();
});
document.getElementById('cal-next').addEventListener('click', () => {
  calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() + 1, 1);
  renderCalendar();
});
document.getElementById('cal-today').addEventListener('click', () => {
  const t = new Date();
  calCursor = new Date(t.getFullYear(), t.getMonth(), 1);
  selectedDate = isoDate(t);
  renderCalendar(); renderCalSide();
});
renderCalendar(); renderCalSide();
