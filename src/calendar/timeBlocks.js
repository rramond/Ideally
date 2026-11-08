import { uid } from '../lib/utils.js';
import { pad, parseIso, toHours, fromHours } from '../lib/dates.js';
import { toast } from '../lib/toast.js';
import { showContextMenu } from '../lib/contextMenu.js';
import { getBlocks, getBlock, deleteBlock, saveEvent, typeOf, onEventsChange } from './events.js';
import { openBlockEditor } from './eventEditor.js';
import { slotAt } from './calendar.js';

/* ============================================================
   TIME BLOCKS (3c.2) — premade events with a fixed duration,
   type, description and repeat. Made in the Time Blocks side
   panel, then dragged onto a day: over a column they snap to
   its hour / half-hour rows; dropping one creates an event.
============================================================ */
const listEl = document.getElementById('tb-list');
const DRAG_START = 5;            // px the pointer must move before a press becomes a drag

/* "01:30" → "1h 30m", "00:45" → "45m", "02:00" → "2h" */
function durLabel(dur){
  const [h, m] = dur.split(':').map(Number);
  return [h ? h + 'h' : '', m ? m + 'm' : ''].filter(Boolean).join(' ') || '0m';
}

function render(){
  listEl.innerHTML = '';
  const blocks = getBlocks();
  if (!blocks.length){
    const empty = document.createElement('p');
    empty.className = 'tb-empty';
    empty.textContent = 'No blocks yet. Create one, then drag it onto a day.';
    listEl.appendChild(empty);
    return;
  }
  blocks.forEach(b => {
    const t = typeOf(b);
    const item = document.createElement('div');
    item.className = 'tb-item';
    item.dataset.id = b.id;
    item.tabIndex = 0;
    item.style.setProperty('--tc', t.color);
    const repeats = b.recur && b.recur.kind !== 'none';
    const name = document.createElement('span');
    name.className = 'tb-name';
    name.textContent = b.title;
    const meta = document.createElement('span');
    meta.className = 'tb-meta';
    meta.textContent = durLabel(b.duration) + ' · ' + t.name + (repeats ? ' ↻' : '');
    item.append(name, meta);
    item.title = b.title + ' (' + durLabel(b.duration) + ')' + (b.description ? '\n' + b.description : '') +
                 '\nDrag onto a day · click to edit';
    item.addEventListener('keydown', e => {
      if (e.key === 'Enter'){ e.preventDefault(); openBlockEditor({ block: getBlock(b.id) }); }
    });
    listEl.appendChild(item);
  });
}

document.getElementById('tb-new').addEventListener('click', () => openBlockEditor());

listEl.addEventListener('contextmenu', e => {
  const item = e.target.closest('.tb-item');
  if (!item) return;
  e.preventDefault();
  const b = getBlock(item.dataset.id);
  if (!b) return;
  showContextMenu(e.clientX, e.clientY, [
    { label: 'Edit block', action: () => openBlockEditor({ block: getBlock(b.id) }) },
    { label: 'Delete block', danger: true, action: () => { deleteBlock(b.id); toast('Deleted “' + b.title + '”'); } }
  ]);
});

/* ---- press: a click edits the block, a drag places it ---- */
listEl.addEventListener('pointerdown', e => {
  const item = e.target.closest('.tb-item');
  if (!item || e.button !== 0) return;
  e.preventDefault();                       // no text selection while dragging
  const block = getBlock(item.dataset.id);
  if (!block) return;
  const x0 = e.clientX, y0 = e.clientY;
  const dur = Math.min(24, toHours(block.duration));
  const color = typeOf(block).color;
  let ghost = null, preview = null, slot = null;

  const startDrag = () => {
    item.classList.add('dragging');
    document.body.classList.add('tb-dragging');
    ghost = document.createElement('div');
    ghost.className = 'tb-ghost';
    ghost.style.setProperty('--tc', color);
    ghost.textContent = block.title;
    document.body.appendChild(ghost);
    preview = document.createElement('div');
    preview.className = 'ev-block tb-preview';
    preview.style.setProperty('--tc', color);
    preview.style.height = 'calc(var(--hour, 40px) * ' + dur + ' - 3px)';
    const time = document.createElement('span');
    time.className = 'ev-time';
    const title = document.createElement('span');
    title.className = 'ev-title';
    title.textContent = block.title;
    preview.append(time, title);
  };

  const move = ev => {
    if (!ghost){
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < DRAG_START) return;
      startDrag();
    }
    slot = slotAt(ev.clientX, ev.clientY, dur);
    /* over a day the block snaps to the rows; anywhere else it follows the cursor */
    ghost.hidden = !!slot;
    ghost.style.transform = 'translate(' + (ev.clientX + 12) + 'px,' + (ev.clientY + 10) + 'px)';
    if (slot){
      if (preview.parentElement !== slot.grid) slot.grid.appendChild(preview);
      preview.style.top = 'calc(var(--hour, 40px) * ' + slot.hour + ')';
      preview.firstChild.textContent = fromHours(slot.hour) + '–' + fromHours(Math.min(24, slot.hour + dur));
    } else {
      preview.remove();
    }
  };

  const finish = drop => {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    document.removeEventListener('pointercancel', cancel);
    document.removeEventListener('keydown', esc, true);
    if (!ghost){                            // never moved: it was a click
      if (drop) openBlockEditor({ block: getBlock(block.id) });
      return;
    }
    item.classList.remove('dragging');
    document.body.classList.remove('tb-dragging');
    ghost.remove();
    preview.remove();
    if (drop && slot) place(block, slot, dur);
  };
  const up = () => finish(true);
  const cancel = () => finish(false);
  const esc = ev => {
    if (ev.key === 'Escape' && ghost){ ev.preventDefault(); ev.stopPropagation(); finish(false); }
  };
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
  document.addEventListener('pointercancel', cancel);
  document.addEventListener('keydown', esc, true);
});

/* dropping a block makes an ordinary event (editable like any other) */
function place(block, { date, hour }, dur){
  const start = fromHours(hour);
  saveEvent({
    id: uid(),
    title: block.title,
    date,
    start,
    end: fromHours(Math.min(24, hour + dur)),
    description: block.description || '',
    typeId: block.typeId,
    recur: { ...(block.recur || { kind: 'none' }) },
    blockId: block.id
  });
  const d = parseIso(date);
  toast('Added “' + block.title + '” on ' + pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + ' at ' + start);
}

onEventsChange(render);
render();
