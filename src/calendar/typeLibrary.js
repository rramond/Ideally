import { uid } from '../lib/utils.js';
import { isoDate } from '../lib/dates.js';
import { toast } from '../lib/toast.js';
import { showContextMenu } from '../lib/contextMenu.js';
import { go, back, getState } from '../lib/history.js';
import { attachColorWheel } from '../colorWheel.js';
import { farthestColor } from '../lib/palette.js';
import { RECURRENCE, getTypes, saveType, deleteType, getEvents, getBlocks, getEvent, getBlock,
         paintColors, onEventsChange } from './events.js';
import { openEventEditor, openBlockEditor } from './eventEditor.js';

/* ============================================================
   EVENT TYPE LIBRARY (3h) — the Types side panel lists every
   type, most used first. Clicking one opens it in the main area
   (instead of the week): its color circle and editable name on
   the left, "12 events · 3 blocks" on the right, then every
   event of that type in chronological order (NAME - hour -
   DD.MM.YY, each row in the event's colors) and, last, the time
   blocks of that type. Name and color changes are saved live.
============================================================ */
const listEl = document.getElementById('ty-list');
const viewEl = document.getElementById('type-view');

const el = (tag, cls, text) => {
  const x = document.createElement(tag);
  if (cls) x.className = cls;
  if (text != null) x.textContent = text;
  return x;
};
const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');
/* 'YYYY-MM-DD' → 'DD.MM.YY' */
const shortDate = iso => iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(2, 4);
/* "01:30" → "1h 30m" */
const durLabel = dur => { const [h, m] = dur.split(':').map(Number); return [h ? h + 'h' : '', m ? m + 'm' : ''].filter(Boolean).join(' ') || '0m'; };
const repeats = e => e.recur && e.recur.kind !== 'none';
const recurLabel = e => e.recur.kind === 'everyN' ? 'every ' + (e.recur.n || 2) + ' days'
  : (RECURRENCE.find(([k]) => k === e.recur.kind) || [])[1]?.toLowerCase() || '';

const eventsOfType = id => getEvents().filter(e => e.typeId === id)
  .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
const blocksOfType = id => getBlocks().filter(b => b.typeId === id).sort((a, b) => a.title.localeCompare(b.title));
const usage = id => ({ events: eventsOfType(id).length, blocks: blocksOfType(id).length });
const usageLabel = ({ events, blocks }) => plural(events, 'event') + (blocks ? ' · ' + plural(blocks, 'block') : '');

/* ---------------- side panel ---------------- */
function renderPanel(){
  listEl.innerHTML = '';
  const open = (getState() || {}).typeId || null;   // null while main.js is still starting up
  const types = getTypes().map(t => ({ t, use: usage(t.id) }))
    .sort((a, b) => (b.use.events + b.use.blocks) - (a.use.events + a.use.blocks) || a.t.name.localeCompare(b.t.name));
  types.forEach(({ t, use }) => {
    const item = el('div', 'ty-item' + (t.id === open ? ' on' : ''));
    item.dataset.id = t.id;
    item.tabIndex = 0;
    item.style.setProperty('--tc', t.color);
    const text = el('div', 'ty-text');
    text.append(el('span', 'tb-name', t.name), el('span', 'tb-meta', usageLabel(use)));
    item.append(el('i', 'ty-dot'), text);
    item.title = t.name + ' · ' + usageLabel(use) + '\nClick to open';
    const openIt = () => { if (getState().typeId !== t.id) go({ typeId: t.id }); };
    item.addEventListener('click', openIt);
    item.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); openIt(); } });
    listEl.appendChild(item);
  });
}

/* New Type: made right away with a color far from the other types', then opened with its name ready to type */
document.getElementById('ty-new').addEventListener('click', () => {
  const t = { id: uid(), name: 'New type', color: farthestColor(getTypes().map(x => x.color)) };
  saveType(t);
  renameOnOpen = t.id;
  go({ typeId: t.id });
});
let renameOnOpen = null;

listEl.addEventListener('contextmenu', e => {
  const item = e.target.closest('.ty-item');
  if (!item) return;
  e.preventDefault();
  const t = getTypes().find(x => x.id === item.dataset.id);
  if (!t) return;
  const items = [{ label: 'Open type', action: () => { if (getState().typeId !== t.id) go({ typeId: t.id }); } }];
  if (getTypes().length > 1) items.push({ label: 'Delete type', danger: true, action: () => removeType(t) });
  showContextMenu(e.clientX, e.clientY, items);
});

/* events of a deleted type fall back to the first type (events.js) */
function removeType(t){
  const { events, blocks } = usage(t.id);
  deleteType(t.id);
  toast('Deleted type “' + t.name + '”' + (events + blocks ? ' — its ' + usageLabel({ events, blocks }) + ' now use “' + getTypes()[0].name + '”' : ''));
}

/* ---------------- the type view (main area) ---------------- */
let openId = null, destroyWheel = null;
let head = null, nameEl = null, colorBtn = null, totalEl = null, rows = null, delBtn = null;

/* called from main.js on every navigation step: open typeId's view, or clear it */
export function showTypeView(typeId){
  if (typeId === openId){ if (typeId) refreshView(); return; }
  teardown();
  openId = typeId;
  if (!typeId) return;
  const type = getTypes().find(t => t.id === typeId);
  if (!type){ openId = null; back(); return; }
  build(type);
  refreshView();
  if (renameOnOpen === typeId){ renameOnOpen = null; startRename(); }
}

function teardown(){
  if (destroyWheel) destroyWheel();
  destroyWheel = null;
  viewEl.innerHTML = '';
  head = nameEl = colorBtn = totalEl = rows = delBtn = null;
}

function build(type){
  head = el('div', 'ty-head');
  const colorWrap = el('div', 'ee-type-wrap');
  colorBtn = el('button', 'ee-type ty-color');
  colorBtn.type = 'button';
  colorBtn.title = 'Type color';
  colorWrap.appendChild(colorBtn);
  nameEl = el('h2', 'ee-name ty-name');
  nameEl.title = 'Click to rename the type';
  totalEl = el('span', 'ty-total');
  head.append(colorWrap, nameEl, totalEl);
  rows = el('div', 'ty-list');
  const foot = el('div', 'ty-foot');
  delBtn = el('button', 'danger-link', 'delete type');
  delBtn.type = 'button';
  delBtn.addEventListener('click', () => { const t = current(); if (t) removeType(t); });
  foot.appendChild(delBtn);
  viewEl.append(head, rows, foot);

  /* color: live, straight into the type (the calendar follows) */
  destroyWheel = attachColorWheel(colorBtn, () => (current() || type).color, hex => {
    const t = current();
    if (t && t.color !== hex) saveType({ ...t, color: hex });
  });

  /* name: click selects it all; Enter / clicking away saves, Esc reverts, empty is ignored */
  nameEl.addEventListener('click', () => { if (!nameEl.isContentEditable) startRename(); });
  nameEl.addEventListener('keydown', e => {
    if (e.key === 'Enter'){ e.preventDefault(); nameEl.blur(); }
    else if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); nameEl.textContent = current()?.name || ''; nameEl.blur(); }
  });
  nameEl.addEventListener('paste', e => {
    e.preventDefault();
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain').replace(/\s+/g, ' '));
  });
  nameEl.addEventListener('blur', () => {
    nameEl.contentEditable = 'false';
    const t = current();
    const name = nameEl.textContent.trim().slice(0, 24);
    if (t && name && name !== t.name) saveType({ ...t, name });
    else if (t) nameEl.textContent = t.name;
  });
}
const current = () => getTypes().find(t => t.id === openId) || null;

function startRename(){
  if (!nameEl) return;
  nameEl.contentEditable = 'true';
  nameEl.focus();
  const r = document.createRange();
  r.selectNodeContents(nameEl);
  const sel = getSelection();
  sel.removeAllRanges(); sel.addRange(r);
}

/* head + rows follow the data; the head's elements are kept (the color wheel may be open) */
function refreshView(){
  const t = current();
  if (!t){ if ((getState() || {}).typeId === openId) back(); return; }
  colorBtn.style.background = t.color;
  colorBtn.style.setProperty('--tc', t.color);
  viewEl.style.setProperty('--tc', t.color);
  if (!nameEl.isContentEditable) nameEl.textContent = t.name;
  const use = usage(t.id);
  totalEl.textContent = usageLabel(use).toUpperCase();
  delBtn.hidden = getTypes().length < 2;

  rows.innerHTML = '';
  const events = eventsOfType(t.id), blocks = blocksOfType(t.id);
  if (!events.length && !blocks.length){
    rows.appendChild(el('p', 'ty-empty', 'Nothing uses this type yet. Pick it in an event or a time block.'));
    return;
  }
  const today = isoDate(new Date());
  events.forEach(e => {
    const row = el('button', 'ty-row' + (e.date < today && !repeats(e) ? ' past' : ''));
    row.type = 'button';
    paintColors(row, e);
    row.append(
      el('span', 'ty-row-name', e.title),
      el('span', 'ty-sep', '-'),
      el('span', 'ty-row-time', e.start),
      el('span', 'ty-sep', '-'),
      el('span', 'ty-row-date', shortDate(e.date))
    );
    if (repeats(e)) row.appendChild(el('span', 'ty-row-recur', '↻ ' + recurLabel(e)));
    row.title = e.title + ' · ' + e.start + '–' + e.end + ' · ' + shortDate(e.date) + (e.description ? '\n' + e.description : '') + '\nClick to edit';
    row.addEventListener('click', () => { const ev = getEvent(e.id); if (ev) openEventEditor({ event: ev }); });
    rows.appendChild(row);
  });
  if (blocks.length){
    rows.appendChild(el('p', 'dd-group ty-group', 'Time blocks'));
    blocks.forEach(b => {
      const row = el('button', 'ty-row');
      row.type = 'button';
      paintColors(row, b);
      row.append(
        el('span', 'ty-row-name', b.title),
        el('span', 'ty-sep', '-'),
        el('span', 'ty-row-time', durLabel(b.duration)),
        el('span', 'ty-sep', '-'),
        el('span', 'ty-row-date', 'block')
      );
      if (repeats(b)) row.appendChild(el('span', 'ty-row-recur', '↻ ' + recurLabel(b)));
      row.title = b.title + ' · ' + durLabel(b.duration) + (b.description ? '\n' + b.description : '') + '\nClick to edit';
      row.addEventListener('click', () => { const bl = getBlock(b.id); if (bl) openBlockEditor({ block: bl }); });
      rows.appendChild(row);
    });
  }
}

onEventsChange(() => { renderPanel(); if (openId) refreshView(); });
renderPanel();
