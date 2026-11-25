import { clamp } from '../lib/utils.js';
import { openPopup, closePopup } from '../lib/history.js';
import { addCloseX } from '../lib/popups.js';
import { remindersOn, getReminder } from './reminders.js';
import { pictogramNode } from './pictograms.js';
import { fmtDate } from './periodEditor.js';
import { openReminderEditor } from './reminderEditor.js';

/* ============================================================
   REMINDER STICKERS on a day's date box (the column header).
   Each sticker lands at a random spot inside the box, tilted
   −30° … 30°, without touching the date text or another sticker.
   Hitboxes: the date's text (DD.MM and the weekday) is a
   rectangle; a sticker is a circle around its glyph only — the
   white contour isn't counted, so contours may overlap a little.
   The spots are seeded by each reminder's id and placed in the
   order the reminders were made, so they stay put on every
   redraw, and a new reminder never moves the older ones.
   A day too full to fit them shrinks its stickers step by step;
   at the smallest size a sticker that still doesn't fit takes
   the spot where it overlaps least.
   Hover shows the name; click shows a card with the description.
============================================================ */
const CARD = 'reminder-card';
const TILT = 30;               // max rotation either way (degrees)
const HIT = 0.42;              // hitbox radius, as a fraction of the sticker size (the glyph without its contour)
const DATE_PAD = 2;            // px of room kept around the date text
const TRIES = 250;             // random spots tried per sticker
const SHRINK = 0.85, MIN_K = 0.5;

const el = (tag, cls, text) => {
  const x = document.createElement(tag);
  if (cls) x.className = cls;
  if (text != null) x.textContent = text;
  return x;
};
/* a small, stable pseudo-random number generator seeded by a string */
function seeded(str){
  let h = 2166136261;
  for (let i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/* adds the day's stickers to its header (does nothing on a day without reminders);
   they are placed by layoutStickers once the header is on screen */
export function addStickers(head, dateStr){
  const list = remindersOn(dateStr);
  if (!list.length) return;
  head.classList.add('has-reminders');
  const layer = el('div', 'rem-stickers');
  list.forEach((r, i) => {
    const s = el('button', 'rem-sticker rem-sticker-look');
    s.type = 'button';
    s.dataset.id = r.id;
    s.style.setProperty('--tilt', Math.round((seeded(r.id + '/tilt')() * 2 - 1) * TILT) + 'deg');
    s.style.zIndex = String(list.length - i);          // the first sticker of a day lies on top
    s.setAttribute('aria-label', r.name);
    s.appendChild(pictogramNode(r.icon, 'pg'));
    /* own the pointer: no date selection, no header drag (new period) */
    s.addEventListener('pointerdown', e => e.stopPropagation());
    s.addEventListener('dblclick', e => e.stopPropagation());
    s.addEventListener('click', e => { e.stopPropagation(); hideTag(); openCard(r.id, s); });
    s.addEventListener('mouseenter', () => showTag(r, s));
    s.addEventListener('mouseleave', hideTag);
    layer.appendChild(s);
  });
  head.appendChild(layer);
}

/* circle (x, y, r) against rectangle: how deep they overlap (0 = apart) */
function rectDepth(x, y, r, b){
  const dx = x - clamp(x, b.l, b.r), dy = y - clamp(y, b.t, b.b);
  return Math.max(0, r - Math.hypot(dx, dy));
}

/* places the stickers of one header; false while it has no size (another tab is open) */
function layoutHead(head){
  const W = head.clientWidth, H = head.clientHeight;
  const stickers = [...head.querySelectorAll('.rem-sticker')];
  if (!W || !H || !stickers.length) return false;
  /* the date's hitbox: the weekday + DD.MM text, a little padded */
  const hr = head.getBoundingClientRect();
  const texts = [...head.querySelectorAll('.dh-init, .dh-date')].map(t => t.getBoundingClientRect());
  const date = {
    l: Math.min(...texts.map(t => t.left)) - hr.left - DATE_PAD, r: Math.max(...texts.map(t => t.right)) - hr.left + DATE_PAD,
    t: Math.min(...texts.map(t => t.top)) - hr.top - DATE_PAD,   b: Math.max(...texts.map(t => t.bottom)) - hr.top + DATE_PAD
  };
  stickers.forEach(s => s.style.removeProperty('--rem-k'));
  const base = parseFloat(getComputedStyle(stickers[0]).fontSize) || 17;

  let k = 1, spots;
  for (;;){
    const r = base * k * HIT;
    /* the box is too small for even one sticker: center them, overlapping */
    const xr = Math.max(0, W - 2 * r), yr = Math.max(0, H - 2 * r);
    spots = [];
    let allFit = true;
    stickers.forEach(s => {
      const rand = seeded(s.dataset.id);
      let best = null;
      for (let i = 0; i < TRIES; i++){
        const x = r + rand() * xr, y = r + rand() * yr;
        let depth = rectDepth(x, y, r, date);
        spots.forEach(o => { depth += Math.max(0, 2 * r - Math.hypot(x - o.x, y - o.y)); });
        if (!best || depth < best.depth) best = { x, y, depth };
        if (depth === 0) break;
      }
      if (best.depth > 0) allFit = false;
      spots.push(best);
    });
    if (allFit || k * SHRINK < MIN_K) break;
    k *= SHRINK;
  }
  stickers.forEach((s, i) => {
    s.style.left = spots[i].x + 'px';
    s.style.top = spots[i].y + 'px';
    if (k < 1) s.style.setProperty('--rem-k', k.toFixed(3));
  });
  return true;
}

/* places every sticker under root (call once the headers are laid out, and on resize) */
export function layoutStickers(root){
  root.querySelectorAll('.day-head.has-reminders').forEach(layoutHead);
}

/* ---- hover: the name in a small tag under the sticker ---- */
const tag = el('div', 'period-tag rem-tag');
tag.hidden = true;
document.body.appendChild(tag);
function showTag(r, s){
  tag.innerHTML = '';
  const row = el('div', 'pt-row');
  row.append(pictogramNode(r.icon, 'pg rem-tag-icon'), document.createTextNode(r.name));
  tag.appendChild(row);
  tag.hidden = false;
  const b = s.getBoundingClientRect();
  tag.style.left = clamp(b.left + b.width / 2 - tag.offsetWidth / 2, 8, innerWidth - tag.offsetWidth - 8) + 'px';
  tag.style.top = (b.bottom + 6) + 'px';
}
export function hideTag(){ tag.hidden = true; }

/* ---- click: a small card with the pictogram, name, date and description ---- */
function openCard(id, anchor){
  closePopup(CARD);
  const r = getReminder(id);
  if (!r) return;
  const card = el('div', 'rem-pop');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', r.name);
  const head = el('div', 'rem-pop-head');
  const text = el('div', 'rem-pop-text');
  text.append(el('span', 'rem-pop-name', r.name), el('span', 'rem-pop-date', fmtDate(r.date)));
  head.append(pictogramNode(r.icon, 'pg rem-sticker-look rem-pop-icon'), text);
  const desc = el('p', 'rem-pop-desc' + (r.description ? '' : ' empty'), r.description || 'No description');
  const edit = el('button', 'ghost-btn rem-pop-edit', 'Edit');
  edit.type = 'button';
  edit.addEventListener('click', () => { closePopup(CARD); openReminderEditor({ reminder: getReminder(id) }); });
  card.append(head, desc, edit);
  document.body.appendChild(card);
  addCloseX(card, () => closePopup(CARD));

  const b = anchor.getBoundingClientRect();
  card.style.left = clamp(b.left + b.width / 2 - card.offsetWidth / 2, 8, innerWidth - card.offsetWidth - 8) + 'px';
  const below = b.bottom + 8;
  card.style.top = (below + card.offsetHeight > innerHeight - 8 ? Math.max(8, b.top - 8 - card.offsetHeight) : below) + 'px';

  const onDown = e => { if (!card.contains(e.target)) closePopup(CARD); };
  openPopup(CARD, () => { card.remove(); document.removeEventListener('pointerdown', onDown, true); });
  /* capture: a click elsewhere closes the card before it does anything else */
  setTimeout(() => document.addEventListener('pointerdown', onDown, true), 0);
}
