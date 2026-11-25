import { isoDate } from '../lib/dates.js';
import { toast } from '../lib/toast.js';
import { showContextMenu } from '../lib/contextMenu.js';
import { getReminders, getReminder, deleteReminder, onRemindersChange } from './reminders.js';
import { openReminderEditor } from './reminderEditor.js';
import { pictogramNode } from './pictograms.js';
import { showWeekOf } from './calendar.js';

/* ============================================================
   REMINDERS side panel — "New Reminder", then every reminder:
   upcoming first (soonest on top), the past ones dimmed below.
   Click to edit, ↗ (or the right-click menu) jumps to its week.
============================================================ */
const listEl = document.getElementById('rem-list');
/* "16.11", or "16.11.27" outside the current year */
const short = iso => {
  const [y, m, d] = iso.split('-');
  return d + '.' + m + (Number(y) === new Date().getFullYear() ? '' : '.' + y.slice(2));
};
/* "today", "tomorrow", "in 5 days", "3 days ago" */
function relative(iso){
  const a = new Date(iso + 'T00:00:00'), b = new Date(isoDate(new Date()) + 'T00:00:00');
  const n = Math.round((a - b) / 86400000);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  return n > 0 ? 'in ' + n + ' days' : -n + ' days ago';
}

function item(r, today){
  const row = document.createElement('div');
  row.className = 'rem-item' + (r.date < today ? ' past' : '') + (r.date === today ? ' now' : '');
  row.dataset.id = r.id;
  row.tabIndex = 0;
  const text = document.createElement('div');
  text.className = 'pe-text';
  const name = document.createElement('span');
  name.className = 'tb-name';
  name.textContent = r.name;
  const meta = document.createElement('span');
  meta.className = 'tb-meta';
  meta.textContent = short(r.date) + ' · ' + relative(r.date);
  text.append(name, meta);
  const jump = document.createElement('button');
  jump.type = 'button';
  jump.className = 'pe-jump';
  jump.title = 'Show in calendar';
  jump.textContent = '↗';
  jump.addEventListener('click', e => { e.stopPropagation(); showWeekOf(r.date); });
  row.append(pictogramNode(r.icon, 'pg rem-sticker-look rem-item-icon'), text, jump);
  row.title = r.name + (r.description ? '\n' + r.description : '') + '\nClick to edit';
  const edit = () => { const cur = getReminder(r.id); if (cur) openReminderEditor({ reminder: cur }); };
  row.addEventListener('click', edit);
  row.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); edit(); } });
  return row;
}

function render(){
  listEl.innerHTML = '';
  const all = getReminders();
  if (!all.length){
    const empty = document.createElement('p');
    empty.className = 'tb-empty';
    empty.textContent = 'No reminders yet. Create one for a birthday, an anniversary or a deadline — it shows as a sticker on its day.';
    listEl.appendChild(empty);
    return;
  }
  const today = isoDate(new Date());
  const upcoming = all.filter(r => r.date >= today);
  const past = all.filter(r => r.date < today).reverse();     // the most recent first
  upcoming.forEach(r => listEl.appendChild(item(r, today)));
  if (past.length){
    const h = document.createElement('div');
    h.className = 'nav-label rem-group';
    h.textContent = 'Past';
    listEl.appendChild(h);
    past.forEach(r => listEl.appendChild(item(r, today)));
  }
}

document.getElementById('rem-new').addEventListener('click', () => openReminderEditor());

listEl.addEventListener('contextmenu', e => {
  const row = e.target.closest('.rem-item');
  if (!row) return;
  e.preventDefault();
  const r = getReminder(row.dataset.id);
  if (!r) return;
  showContextMenu(e.clientX, e.clientY, [
    { label: 'Show in calendar', action: () => showWeekOf(r.date) },
    { label: 'Edit reminder', action: () => openReminderEditor({ reminder: getReminder(r.id) }) },
    { label: 'Delete reminder', danger: true, action: () => { deleteReminder(r.id); toast('Deleted reminder “' + r.name + '”'); } }
  ]);
});

onRemindersChange(render);
render();
/* past midnight: "today" / "in N days" move on */
let renderedFor = isoDate(new Date());
setInterval(() => { if (isoDate(new Date()) !== renderedFor){ renderedFor = isoDate(new Date()); render(); } }, 60000);
