import { store } from './lib/storage.js';
import { uid, clamp, shade } from './lib/utils.js';
import { attachColorWheel } from './colorWheel.js';
import { sanitizeHtml, stripStyle, styleRange, rangeEvery, rangeStartElement, rgbToHex } from './lib/richText.js';

/* ============================================================
   VISION BOARD — infinite canvas with pan/zoom, 3D stickies,
   editable arrows
============================================================ */
const DEFAULT_STICKY_COLOR = '#FFD84D';
const MIN_W = 150, MIN_H = 130, MAX_W = 460, MAX_H = 440;
const ARROW_GAP = 12;
const TITLE_FONT = 32, TITLE_MIN_FONT = 12, TITLE_MAX_FONT = 160;

let stickies = store.get('ideally.stickies', []);
stickies.forEach(s => { if (!s.w) s.w = 190; if (!s.h) s.h = 170; });
let arrows = store.get('ideally.arrows', []);
let zCounter = stickies.reduce((m,s) => Math.max(m, s.z || 1), 1);
let activeColor = store.get('ideally.activeColor', DEFAULT_STICKY_COLOR); // color of every NEW sticky until changed
let connectMode = false, connectFrom = null;
let selectedArrow = null;
let selectedItem = null;             // id of the selected sticky/title
let textRange = null, textItemId = null; // highlighted text inside an item, if any
const stickyEls = {};

const stage = document.getElementById('board-stage');
const world = document.getElementById('board-world');
const floor = document.getElementById('board-floor');
const arrowPaths = document.getElementById('arrow-paths');
const arrowHandles = document.getElementById('arrow-handles');
const connectBtn = document.getElementById('connect-btn');
const boardEmpty = document.getElementById('board-empty');
const zoomPill = document.getElementById('zoom-pill');

const savedView = store.get('ideally.view', { x: 0, y: 0, z: 1 });
let pan = { x: savedView.x, y: savedView.y };
let zoom = savedView.z;

function saveStickies(){ store.set('ideally.stickies', stickies); }
function saveArrows(){ store.set('ideally.arrows', arrows); }
function saveView(){ store.set('ideally.view', { x: pan.x, y: pan.y, z: zoom }); }

function applyView(){
  world.style.transform = 'translate(' + pan.x + 'px,' + pan.y + 'px) scale(' + zoom + ')';
  stage.style.backgroundPosition = pan.x + 'px ' + pan.y + 'px';
  stage.style.backgroundSize = (26 * zoom) + 'px ' + (26 * zoom) + 'px';
  zoomPill.textContent = Math.round(zoom * 100) + '%';
  renderHandles();
}
function clientToWorld(e){
  const r = stage.getBoundingClientRect();
  return { x: (e.clientX - r.left - pan.x) / zoom, y: (e.clientY - r.top - pan.y) / zoom };
}

/* ---- pan (drag the background) ---- */
let panning = false, panStart = null;
stage.addEventListener('pointerdown', e => {
  if (e.target !== stage && e.target !== world) return;
  if (connectMode){ setConnectMode(false); return; }
  if (selectedArrow){ selectedArrow = null; renderArrows(); renderHandles(); }
  selectItem(null);
  panning = true;
  stage.classList.add('panning');
  stage.setPointerCapture(e.pointerId);
  panStart = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
});
stage.addEventListener('pointermove', e => {
  if (!panning) return;
  pan.x = panStart.px + (e.clientX - panStart.mx);
  pan.y = panStart.py + (e.clientY - panStart.my);
  applyView();
});
stage.addEventListener('pointerup', e => {
  if (!panning) return;
  panning = false;
  stage.classList.remove('panning');
  stage.releasePointerCapture(e.pointerId);
  saveView();
});

/* ---- zoom (scroll, anchored at the cursor) ---- */
stage.addEventListener('wheel', e => {
  e.preventDefault();
  const r = stage.getBoundingClientRect();
  const cx = e.clientX - r.left, cy = e.clientY - r.top;
  const wx = (cx - pan.x) / zoom, wy = (cy - pan.y) / zoom;
  const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
  zoom = clamp(zoom * factor, 0.25, 2.5);
  pan.x = cx - wx * zoom;
  pan.y = cy - wy * zoom;
  applyView(); saveView();
}, { passive: false });

zoomPill.addEventListener('click', () => {
  pan = { x: 0, y: 0 }; zoom = 1;
  applyView(); saveView();
});

/* ---- sticky color: one swatch that opens a color wheel ---- */
const colorSwatch = document.getElementById('color-swatch');
colorSwatch.style.background = activeColor;
attachColorWheel(colorSwatch, () => activeColor, hex => {
  activeColor = hex;
  colorSwatch.style.background = hex;
  store.set('ideally.activeColor', hex);
});

/* ---- arrow geometry: lock to facing-side midpoints, gap kept ---- */
function sideAnchors(a, b){
  const ca = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  const cb = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const dx = cb.x - ca.x, dy = cb.y - ca.y;
  let p1, p2, n1, n2;
  if (Math.abs(dx) >= Math.abs(dy)){
    if (dx >= 0){
      p1 = { x: a.x + a.w + ARROW_GAP, y: ca.y }; n1 = { x: 1, y: 0 };
      p2 = { x: b.x - ARROW_GAP,       y: cb.y }; n2 = { x: -1, y: 0 };
    } else {
      p1 = { x: a.x - ARROW_GAP,       y: ca.y }; n1 = { x: -1, y: 0 };
      p2 = { x: b.x + b.w + ARROW_GAP, y: cb.y }; n2 = { x: 1, y: 0 };
    }
  } else {
    if (dy >= 0){
      p1 = { x: ca.x, y: a.y + a.h + ARROW_GAP }; n1 = { x: 0, y: 1 };
      p2 = { x: cb.x, y: b.y - ARROW_GAP };       n2 = { x: 0, y: -1 };
    } else {
      p1 = { x: ca.x, y: a.y - ARROW_GAP };       n1 = { x: 0, y: -1 };
      p2 = { x: cb.x, y: b.y + b.h + ARROW_GAP }; n2 = { x: 0, y: 1 };
    }
  }
  return { p1, p2, n1, n2 };
}
function arrowD(a, b){
  const { p1, p2, n1, n2 } = sideAnchors(a, b);
  const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const k = clamp(dist * 0.35, 24, 110);
  const c1 = { x: p1.x + n1.x * k, y: p1.y + n1.y * k };
  const c2 = { x: p2.x + n2.x * k, y: p2.y + n2.y * k };
  return 'M ' + p1.x + ' ' + p1.y + ' C ' + c1.x + ' ' + c1.y + ', ' + c2.x + ' ' + c2.y + ', ' + p2.x + ' ' + p2.y;
}
const fakeSticky = p => ({ x: p.x - 1, y: p.y - 1, w: 2, h: 2 });

export function renderArrows(){
  arrowPaths.innerHTML = '';
  arrows.forEach(ar => {
    const a = stickies.find(s => s.id === ar.from);
    const b = stickies.find(s => s.id === ar.to);
    if (!a || !b) return;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'arrow' + (ar.id === selectedArrow ? ' sel' : ''));
    path.setAttribute('d', arrowD(a, b));
    path.setAttribute('marker-end', ar.id === selectedArrow ? 'url(#arrowhead-hot)' : 'url(#arrowhead)');
    path.dataset.id = ar.id;
    path.addEventListener('mouseenter', () => path.setAttribute('marker-end', 'url(#arrowhead-hot)'));
    path.addEventListener('mouseleave', () => {
      if (ar.id !== selectedArrow) path.setAttribute('marker-end', 'url(#arrowhead)');
    });
    path.addEventListener('pointerdown', e => {
      e.stopPropagation();
      selectedArrow = ar.id;
      renderArrows(); renderHandles();
    });
    path.addEventListener('dblclick', e => {
      e.stopPropagation();
      arrows = arrows.filter(x => x.id !== ar.id);
      if (selectedArrow === ar.id) selectedArrow = null;
      saveArrows(); renderArrows(); renderHandles();
    });
    arrowPaths.appendChild(path);
  });
}

function updateArrows(){
  arrowPaths.querySelectorAll('.arrow').forEach(path => {
    const ar = arrows.find(x => x.id === path.dataset.id);
    if (!ar) return;
    const a = stickies.find(s => s.id === ar.from);
    const b = stickies.find(s => s.id === ar.to);
    if (a && b) path.setAttribute('d', arrowD(a, b));
  });
  renderHandles();
}

/* ---- endpoint handles: drag to re-anchor an arrow ---- */
export function renderHandles(){
  arrowHandles.innerHTML = '';
  if (!selectedArrow) return;
  const ar = arrows.find(x => x.id === selectedArrow);
  if (!ar) return;
  const a = stickies.find(s => s.id === ar.from);
  const b = stickies.find(s => s.id === ar.to);
  if (!a || !b) return;
  const { p1, p2 } = sideAnchors(a, b);
  [['from', p1], ['to', p2]].forEach(([end, p]) => {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('class', 'a-handle');
    c.setAttribute('cx', p.x); c.setAttribute('cy', p.y);
    c.setAttribute('r', 7 / zoom);
    c.setAttribute('stroke-width', 2 / zoom);
    c.addEventListener('pointerdown', e => startHandleDrag(e, ar, end, c));
    arrowHandles.appendChild(c);
  });
}

function stickyAt(wp){
  const sorted = [...stickies].sort((x, y) => (y.z || 0) - (x.z || 0));
  return sorted.find(s => wp.x >= s.x && wp.x <= s.x + s.w && wp.y >= s.y && wp.y <= s.y + s.h) || null;
}

function startHandleDrag(e, ar, end, handle){
  e.stopPropagation();
  handle.setPointerCapture(e.pointerId);
  const path = arrowPaths.querySelector('[data-id="' + ar.id + '"]');
  let hoverEl = null;
  const otherId = end === 'from' ? ar.to : ar.from;

  const move = ev => {
    const wp = clientToWorld(ev);
    handle.setAttribute('cx', wp.x); handle.setAttribute('cy', wp.y);
    const a = stickies.find(s => s.id === ar.from);
    const b = stickies.find(s => s.id === ar.to);
    if (path && a && b){
      path.setAttribute('d', end === 'from' ? arrowD(fakeSticky(wp), b) : arrowD(a, fakeSticky(wp)));
    }
    const hit = stickyAt(wp);
    if (hoverEl) hoverEl.classList.remove('link-from');
    hoverEl = hit && hit.id !== otherId ? stickyEls[hit.id] : null;
    if (hoverEl) hoverEl.classList.add('link-from');
  };
  const up = ev => {
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', up);
    if (hoverEl) hoverEl.classList.remove('link-from');
    const wp = clientToWorld(ev);
    const hit = stickyAt(wp);
    if (hit && hit.id !== otherId){
      const dup = arrows.some(x => x.id !== ar.id &&
        ((x.from === (end==='from'?hit.id:ar.from) && x.to === (end==='to'?hit.id:ar.to))));
      if (!dup){ ar[end] = hit.id; saveArrows(); }
    }
    renderArrows(); renderHandles();
  };
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', up);
}

/* ---- connect mode ---- */
function setConnectMode(on){
  connectMode = on;
  connectFrom = null;
  connectBtn.classList.toggle('on', on);
  stage.classList.toggle('connecting', on);
  Object.values(stickyEls).forEach(el => el.classList.remove('link-from'));
}
connectBtn.addEventListener('click', () => setConnectMode(!connectMode));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape'){
    if (connectMode) setConnectMode(false);
    if (selectedArrow){ selectedArrow = null; renderArrows(); renderHandles(); }
    if (!document.activeElement.isContentEditable) selectItem(null);
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedArrow
      && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)
      && !document.activeElement.isContentEditable){
    arrows = arrows.filter(x => x.id !== selectedArrow);
    selectedArrow = null;
    saveArrows(); renderArrows(); renderHandles();
  }
});

function handleConnectClick(s, el){
  if (!connectFrom){
    connectFrom = s.id;
    el.classList.add('link-from');
    return;
  }
  if (connectFrom === s.id){ setConnectMode(false); return; }
  const exists = arrows.some(a =>
    (a.from === connectFrom && a.to === s.id) || (a.from === s.id && a.to === connectFrom));
  if (!exists){
    arrows.push({ id: uid(), from: connectFrom, to: s.id });
    saveArrows(); renderArrows();
  }
  setConnectMode(false);
}

/* ---- text formatting: the highlighted text if there is some,
        otherwise the whole selected item ---- */
const fmtGroup = document.getElementById('fmt-group');
const fmtBold = document.getElementById('fmt-bold');
const fmtItalic = document.getElementById('fmt-italic');
const fmtSizeVal = document.getElementById('fmt-size-val');
const fmtColorBar = document.getElementById('fmt-color-bar');
const STICKY_FONT = 13.5, MIN_FONT = 8;

const isBold = s => s.bold ?? s.type === 'title';
const isBoldStyle = cs => parseInt(cs.fontWeight) >= 600;
const isItalicStyle = cs => cs.fontStyle === 'italic';

function applyItemStyle(text, s){
  text.style.fontWeight = isBold(s) ? '700' : '400';
  text.style.fontStyle = s.italic ? 'italic' : '';
  text.style.fontSize = s.fontSize ? s.fontSize + 'px' : '';
  text.style.color = s.textColor || '';
}

function commitText(s, text){
  if (text.innerHTML !== s.html) delete s.scaleRef; // new text → new scaling reference
  s.html = text.innerHTML;
  s.text = text.textContent;
  if (s.type === 'title'){ fitTitle(stickyEls[s.id], s); updateArrows(); }
  saveStickies();
}

function selectItem(id){
  if (selectedItem === id) return;
  selectedItem = id;
  Object.entries(stickyEls).forEach(([k, el]) => el.classList.toggle('selected', k === id));
  refreshFmt();
}

function clearTextRange(){ textRange = null; textItemId = null; refreshFmt(); }

/* what the controls act on right now */
function fmtTarget(){
  const itemTarget = id => {
    const el = stickyEls[id];
    return el ? { s: stickies.find(x => x.id === id), text: el.querySelector('.s-text') } : null;
  };
  const t = textRange && itemTarget(textItemId);
  if (t && t.text.contains(textRange.commonAncestorContainer)) return { ...t, range: textRange };
  const it = selectedItem && itemTarget(selectedItem);
  return it ? { ...it, range: null } : null;
}

function refreshFmt(){
  const t = fmtTarget();
  fmtGroup.classList.toggle('off', !t);
  if (!t){
    fmtBold.classList.remove('on'); fmtItalic.classList.remove('on');
    fmtSizeVal.textContent = '–'; fmtColorBar.style.background = '';
    return;
  }
  const cs = getComputedStyle(t.range ? rangeStartElement(t.range) : t.text);
  fmtBold.classList.toggle('on', t.range ? rangeEvery(t.range, isBoldStyle) : isBold(t.s));
  fmtItalic.classList.toggle('on', t.range ? rangeEvery(t.range, isItalicStyle) : !!t.s.italic);
  fmtSizeVal.textContent = Math.round(parseFloat(cs.fontSize));
  fmtColorBar.style.background = cs.color;
}

/* rangeValue(range) styles the highlighted text; applyToItem(s) restyles the whole
   item, and that style is then cleared from its inline spans so it covers everything */
function applyFormat(prop, rangeValue, applyToItem){
  const t = fmtTarget();
  if (!t) return;
  if (t.range){
    textRange = styleRange(t.text, t.range, prop, rangeValue(t.range));
    if (t.text.isContentEditable){
      const sel = getSelection();
      sel.removeAllRanges(); sel.addRange(textRange);
    }
  } else {
    applyToItem(t.s);
    stripStyle(t.text, prop);
    applyItemStyle(t.text, t.s);
  }
  delete t.s.scaleRef; // text was set by hand → resizing scales from here
  commitText(t.s, t.text);
  refreshFmt();
}

function toggleBold(){
  applyFormat('fontWeight', r => rangeEvery(r, isBoldStyle) ? '400' : '700', s => { s.bold = !isBold(s); });
}
function toggleItalic(){
  applyFormat('fontStyle', r => rangeEvery(r, isItalicStyle) ? 'normal' : 'italic', s => { s.italic = !s.italic; });
}
function stepFontSize(dir){
  const next = cur => {
    const step = cur < 24 ? 1 : cur < 48 ? 2 : 4;
    return clamp(Math.round(cur) + dir * step, MIN_FONT, TITLE_MAX_FONT);
  };
  applyFormat('fontSize',
    r => next(parseFloat(getComputedStyle(rangeStartElement(r)).fontSize)) + 'px',
    s => { s.fontSize = next(s.fontSize || STICKY_FONT); });
}
function setTextColor(hex){
  applyFormat('color', () => hex, s => { s.textColor = hex; });
}

/* the controls must not steal focus, or the highlighted text would be lost */
fmtGroup.addEventListener('mousedown', e => { if (!e.target.closest('input')) e.preventDefault(); });
fmtBold.addEventListener('click', toggleBold);
fmtItalic.addEventListener('click', toggleItalic);
document.getElementById('fmt-size-down').addEventListener('click', () => stepFontSize(-1));
document.getElementById('fmt-size-up').addEventListener('click', () => stepFontSize(1));
attachColorWheel(document.getElementById('fmt-color'), () => {
  const t = fmtTarget();
  return t ? rgbToHex(getComputedStyle(t.range ? rangeStartElement(t.range) : t.text).color) : '#FFFFFF';
}, setTextColor);

/* track highlighted text inside an item being edited */
document.addEventListener('selectionchange', () => {
  const sel = getSelection();
  if (!sel.rangeCount) return;
  const node = sel.anchorNode;
  const el = node && (node.nodeType === Node.TEXT_NODE ? node.parentElement : node);
  const textEl = el && el.closest && el.closest('.s-text');
  if (!textEl || !textEl.isContentEditable) return;
  const r = sel.getRangeAt(0);
  if (sel.isCollapsed || !textEl.contains(r.commonAncestorContainer)){
    if (textRange) clearTextRange();
    return;
  }
  textRange = r.cloneRange();
  textItemId = textEl.closest('.sticky').dataset.id;
  refreshFmt();
});
/* clicking anywhere outside the format controls forgets the highlighted text */
document.addEventListener('pointerdown', e => {
  if (textRange && !fmtGroup.contains(e.target)) clearTextRange();
}, true);

/* ---- stickies ---- */
function applyTransform(el, s, tiltX = 0, tiltY = 0, lift = 0){
  el.style.transform =
    'translate3d(' + s.x + 'px,' + s.y + 'px,' + lift + 'px) ' +
    'rotateZ(' + s.rot + 'deg) rotateX(' + tiltX + 'deg) rotateY(' + tiltY + 'deg)';
}

function renderBoard(){
  floor.innerHTML = '';
  Object.keys(stickyEls).forEach(k => delete stickyEls[k]);
  boardEmpty.style.display = stickies.length ? 'none' : 'flex';
  stickies.forEach(s => {
    const el = buildSticky(s);
    stickyEls[s.id] = el;
    floor.appendChild(el);
    if (s.type === 'title') fitTitle(el, s);
  });
  renderArrows(); renderHandles();
}

function removeItem(id){
  if (selectedItem === id) selectItem(null);
  stickies = stickies.filter(x => x.id !== id);
  arrows = arrows.filter(a => a.from !== id && a.to !== id);
  if (!arrows.some(a => a.id === selectedArrow)) selectedArrow = null;
  saveStickies(); saveArrows(); renderBoard();
}

function beginEdit(text){
  text.setAttribute('contenteditable', 'true');
  text.focus();
  const range = document.createRange();
  range.selectNodeContents(text);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges(); sel.addRange(range);
}

/* titles size to their text; keep w/h in sync so arrows and hit-testing
   use the real box (skipped while the board is hidden and measures 0) */
function fitTitle(el, s){
  if (!el.offsetWidth) return;
  s.w = el.offsetWidth;
  s.h = el.offsetHeight;
}

/* ---- text scaling with the sticky (TODO 1d) ----
   When a resize starts, snapshot the distances from the text's outline to the
   note's right and bottom sides. While resizing, scale every font size by one
   factor k chosen so each distance stays the same fraction of the note's width
   / height. On an uneven resize the tighter side decides, so text never
   overflows. The snapshot lasts until the text is edited or restyled. */
function measureScaleRef(el, text, s){
  const prev = el.style.transform;
  el.style.transform = 'none';          // measure unrotated; only the world zoom remains
  const er = el.getBoundingClientRect(), tr = text.getBoundingClientRect();
  let right = -Infinity, bottom = -Infinity;
  const r = document.createRange();
  const w = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
  while (w.nextNode()){
    if (!w.currentNode.textContent.trim()) continue;
    r.selectNodeContents(w.currentNode);
    const b = r.getBoundingClientRect();
    right = Math.max(right, b.right); bottom = Math.max(bottom, b.bottom);
  }
  el.style.transform = prev;
  if (right === -Infinity) return null;  // no text, nothing to scale

  const ref = {
    w: s.w, h: s.h,
    dR: s.w - (right - er.left) / zoom,  // text outline → note's right side
    dB: s.h - (bottom - er.top) / zoom,  // text outline → note's bottom side
    left: (tr.left - er.left) / zoom,    // where the text starts (padding)
    top: (tr.top - er.top) / zoom,
    f: 1                                 // factor currently applied, relative to this snapshot
  };
  if (ref.w - ref.dR - ref.left <= 0 || ref.h - ref.dB - ref.top <= 0) return null;
  const sizes = [s.fontSize || STICKY_FONT,
    ...[...text.querySelectorAll('span')].map(x => parseFloat(x.style.fontSize)).filter(Boolean)];
  ref.minSize = Math.min(...sizes);
  ref.maxSize = Math.max(...sizes);
  return ref;
}

function scaleText(s, text, ref){
  const kx = (s.w * (1 - ref.dR / ref.w) - ref.left) / (ref.w - ref.dR - ref.left);
  const ky = (s.h * (1 - ref.dB / ref.h) - ref.top) / (ref.h - ref.dB - ref.top);
  const k = clamp(Math.min(kx, ky), MIN_FONT / ref.minSize, TITLE_MAX_FONT / ref.maxSize);
  const ratio = k / ref.f;
  ref.f = k;
  s.fontSize = (s.fontSize || STICKY_FONT) * ratio;
  text.style.fontSize = s.fontSize + 'px';
  text.querySelectorAll('span').forEach(x => {
    const v = parseFloat(x.style.fontSize);
    if (v) x.style.fontSize = (v * ratio) + 'px';
  });
}

function buildSticky(s){
  const isTitle = s.type === 'title';
  const el = document.createElement('div');
  el.className = 'sticky' + (isTitle ? ' title' : '') + (s.id === selectedItem ? ' selected' : '');
  el.dataset.id = s.id;
  if (!isTitle){
    el.style.background = 'linear-gradient(178deg,' + s.color + ' 70%, ' + shade(s.color, -9) + ')';
    el.style.width = s.w + 'px';
    el.style.height = s.h + 'px';
  }
  el.style.zIndex = s.z || 1;
  applyTransform(el, s);

  const text = document.createElement('div');
  text.className = 's-text';
  if (s.html != null) text.innerHTML = sanitizeHtml(s.html);
  else text.textContent = s.text || '';
  applyItemStyle(text, s);
  el.appendChild(text);

  const del = document.createElement('button');
  del.className = 's-del';
  del.title = isTitle ? 'Remove title' : 'Remove sticky';
  del.textContent = '×';
  del.addEventListener('pointerdown', e => e.stopPropagation());
  del.addEventListener('click', () => removeItem(s.id));
  el.appendChild(del);

  const grip = document.createElement('div');
  grip.className = 's-resize';
  let resizing = false, rsX = 0, rsY = 0, origW = 0, origH = 0, origFont = 0;
  grip.addEventListener('pointerdown', e => {
    e.stopPropagation();
    selectItem(s.id);
    resizing = true;
    grip.setPointerCapture(e.pointerId);
    rsX = e.clientX; rsY = e.clientY;
    origW = s.w; origH = s.h; origFont = s.fontSize;
    s.z = ++zCounter; el.style.zIndex = s.z;
    if (!isTitle && !s.scaleRef) s.scaleRef = measureScaleRef(el, text, s);
  });
  grip.addEventListener('pointermove', e => {
    if (!resizing) return;
    if (isTitle){
      /* titles scale uniformly: the text grows with the drag */
      const scale = (origW + (e.clientX - rsX) / zoom) / origW;
      s.fontSize = clamp(origFont * scale, TITLE_MIN_FONT, TITLE_MAX_FONT);
      text.style.fontSize = s.fontSize + 'px';
      fitTitle(el, s);
    } else {
      s.w = clamp(origW + (e.clientX - rsX) / zoom, MIN_W, MAX_W);
      s.h = clamp(origH + (e.clientY - rsY) / zoom, MIN_H, MAX_H);
      el.style.width = s.w + 'px';
      el.style.height = s.h + 'px';
      if (s.scaleRef) scaleText(s, text, s.scaleRef);
    }
    updateArrows();
  });
  grip.addEventListener('pointerup', e => {
    if (!resizing) return;
    resizing = false;
    grip.releasePointerCapture(e.pointerId);
    if (s.scaleRef) s.html = text.innerHTML; // keep the scaled inline sizes, and the snapshot
    saveStickies();
    refreshFmt();
  });
  el.appendChild(grip);

  el.addEventListener('dblclick', () => {
    if (connectMode) return;
    beginEdit(text);
  });
  text.addEventListener('blur', e => {
    text.removeAttribute('contenteditable');
    /* keep the highlighted text targetable while the user is in the format controls */
    if (!fmtGroup.contains(e.relatedTarget)) clearTextRange();
    if (isTitle && !text.textContent.trim()){ removeItem(s.id); return; }
    commitText(s, text);
  });
  text.addEventListener('paste', e => {
    e.preventDefault();
    let plain = e.clipboardData.getData('text/plain');
    if (isTitle) plain = plain.replace(/\s*\n\s*/g, ' ');
    document.execCommand('insertText', false, plain);
  });
  text.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k !== 'b' && k !== 'i' && k !== 'u') return;
    e.preventDefault();               // no native <b>/<i>/<u>; underline isn't supported
    if (k === 'b') toggleBold();
    if (k === 'i') toggleItalic();
  });
  if (isTitle){
    text.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === 'Escape'){ e.preventDefault(); text.blur(); }
    });
    text.addEventListener('input', () => { fitTitle(el, s); updateArrows(); });
  }

  let dragging = false, startX = 0, startY = 0, origX = 0, origY = 0;
  el.addEventListener('pointerdown', e => {
    if (connectMode){ handleConnectClick(s, el); return; }
    selectItem(s.id);
    if (text.isContentEditable) return;
    dragging = true;
    el.classList.add('dragging');
    el.setPointerCapture(e.pointerId);
    startX = e.clientX; startY = e.clientY;
    origX = s.x; origY = s.y;
    s.z = ++zCounter;
    el.style.zIndex = s.z;
    applyTransform(el, s, 0, 0, 40);
  });
  el.addEventListener('pointermove', e => {
    if (dragging){
      s.x = origX + (e.clientX - startX) / zoom;
      s.y = origY + (e.clientY - startY) / zoom;
      applyTransform(el, s, 0, 0, 40);
      updateArrows();
    } else if (e.target === grip || e.target === del){
      /* the tilt pushes the hovered corner behind the board plane, where the
         board would steal the click — keep the note flat over its controls */
      applyTransform(el, s);
    } else if (!isTitle && !text.isContentEditable && !connectMode){
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width  - .5;
      const py = (e.clientY - r.top)  / r.height - .5;
      applyTransform(el, s, -py * 14, px * 14, 14);
    }
  });
  el.addEventListener('pointerup', e => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('dragging');
    el.releasePointerCapture(e.pointerId);
    applyTransform(el, s);
    updateArrows();
    saveStickies();
  });
  el.addEventListener('pointerleave', () => {
    if (!dragging) applyTransform(el, s);
  });
  return el;
}

/* center of the visible stage, in world coordinates */
function viewCenter(){
  const r = stage.getBoundingClientRect();
  return { cx: (r.width / 2 - pan.x) / zoom, cy: (r.height / 2 - pan.y) / zoom };
}

document.getElementById('add-sticky').addEventListener('click', () => {
  const { cx, cy } = viewCenter();
  const s = {
    id: uid(),
    x: cx - 95 + (Math.random() * 60 - 30),
    y: cy - 85 + (Math.random() * 60 - 30),
    w: 190, h: 170,
    rot: (Math.random() * 8 - 4),
    color: activeColor,
    text: '',
    z: ++zCounter
  };
  stickies.push(s);
  saveStickies(); renderBoard();
});

/* a title starts as an empty, focused text box; the blur handler saves it
   (or drops it if nothing was typed) */
document.getElementById('add-title').addEventListener('click', () => {
  const { cx, cy } = viewCenter();
  const s = {
    id: uid(),
    type: 'title',
    x: cx - 60, y: cy - 24,
    w: 120, h: 48,
    rot: 0,
    fontSize: TITLE_FONT,
    text: '',
    z: ++zCounter
  };
  stickies.push(s);
  renderBoard();
  beginEdit(stickyEls[s.id].querySelector('.s-text'));
});

applyView();
renderBoard();
