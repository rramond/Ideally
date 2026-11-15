import { isoDate } from '../lib/dates.js';
import { toast } from '../lib/toast.js';
import { showContextMenu } from '../lib/contextMenu.js';
import { getPeriods, getPeriod, deletePeriod, dayCount, onPeriodsChange } from './periods.js';
import { openPeriodEditor } from './periodEditor.js';
import { showWeekOf } from './calendar.js';

/* ============================================================
   PERIODS side panel (3e) — "New Period" and every period,
   oldest first; past ones are dimmed. Click to edit, ↗ (or the
   right-click menu) jumps to its week.
============================================================ */
const listEl = document.getElementById('pe-list');
/* "16.11", or "16.11.27" outside the current year */
const short = iso => {
  const [y, m, d] = iso.split('-');
  return d + '.' + m + (Number(y) === new Date().getFullYear() ? '' : '.' + y.slice(2));
};

function render(){
  listEl.innerHTML = '';
  const periods = getPeriods();
  if (!periods.length){
    const empty = document.createElement('p');
    empty.className = 'tb-empty';
    empty.textContent = 'No periods yet. Create one, or drag across day headers in the calendar.';
    listEl.appendChild(empty);
    return;
  }
  const today = isoDate(new Date());
  periods.forEach(p => {
    const item = document.createElement('div');
    item.className = 'pe-item' + (p.end < today ? ' past' : '') + (p.start <= today && today <= p.end ? ' now' : '');
    item.dataset.id = p.id;
    item.tabIndex = 0;
    item.style.setProperty('--tc', p.color);
    const name = document.createElement('span');
    name.className = 'tb-name';
    name.textContent = p.name;
    const n = dayCount(p);
    const meta = document.createElement('span');
    meta.className = 'tb-meta';
    meta.textContent = short(p.start) + ' – ' + short(p.end) + ' · ' + n + 'd';
    const jump = document.createElement('button');
    jump.type = 'button';
    jump.className = 'pe-jump';
    jump.title = 'Show in calendar';
    jump.textContent = '↗';
    jump.addEventListener('click', e => { e.stopPropagation(); showWeekOf(p.start); });
    const text = document.createElement('div');
    text.className = 'pe-text';
    text.append(name, meta);
    item.append(text, jump);
    item.title = p.name + ' (' + n + (n === 1 ? ' day' : ' days') + ')\nClick to edit';
    item.addEventListener('click', () => openPeriodEditor({ period: getPeriod(p.id) }));
    item.addEventListener('keydown', e => {
      if (e.key === 'Enter'){ e.preventDefault(); openPeriodEditor({ period: getPeriod(p.id) }); }
    });
    listEl.appendChild(item);
  });
}

document.getElementById('pe-new').addEventListener('click', () => openPeriodEditor({ pickEnd: true }));

listEl.addEventListener('contextmenu', e => {
  const item = e.target.closest('.pe-item');
  if (!item) return;
  e.preventDefault();
  const p = getPeriod(item.dataset.id);
  if (!p) return;
  showContextMenu(e.clientX, e.clientY, [
    { label: 'Show in calendar', action: () => showWeekOf(p.start) },
    { label: 'Edit period', action: () => openPeriodEditor({ period: getPeriod(p.id) }) },
    { label: 'Delete period', danger: true, action: () => { deletePeriod(p.id); toast('Deleted period “' + p.name + '”'); } }
  ]);
});

onPeriodsChange(render);
render();
