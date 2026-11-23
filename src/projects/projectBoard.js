import { uid, clamp } from '../lib/utils.js';
import { store } from '../lib/storage.js';
import { showContextMenu } from '../lib/contextMenu.js';
import { toast } from '../lib/toast.js';
import { attachColorWheel } from '../colorWheel.js';
import { getProject, updateProject } from './projects.js';
import { getFileBlob } from './fileStore.js';
import { addFiles, openFile, downloadFile, deleteFile, sizeLabel, extOf, isImage, kindColor } from './projectFiles.js';

/* ============================================================
   PROJECT BOARD (2f) — the whiteboard a project opens on: sticky
   notes and file cards together on a pan / zoom canvas (the
   Vision board's look, flat — no tilt).
   - stickies: + Sticky or double-click empty space; double-click
     (or Enter) to type; the color swatch sets the color of new
     stickies and recolors the selected one
   - files: drop them on the board (they land where dropped), paste
     them, + File, or Place file (one already in Files). Images show
     as pictures, other files as cards; double-click opens. A file
     card is only a view of a stored file: removing it from the
     board keeps the file in Files; deleting the file in Files
     removes its cards
   - drag to move, the corner grip resizes (images keep their
     shape), drag empty space to pan, wheel zooms, the % pill resets;
     Delete / Backspace removes the selected item
============================================================ */
const STICKY = { w: 190, h: 170, minW: 120, minH: 100, maxW: 560, maxH: 560 };
const CARD = { w: 230, h: 70, minW: 160, minH: 60, maxW: 600, maxH: 300 };
const IMG = { w: 260, minW: 80, maxW: 1000 };
const DEFAULT_COLOR = '#FFD84D';
let activeColor = store.get('ideally.projectStickyColor', DEFAULT_COLOR);

const el = (tag, cls, text) => {
  const x = document.createElement(tag);
  if (cls) x.className = cls;
  if (text != null) x.textContent = text;
  return x;
};
const isDark = hex => {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 140;
};
const editing = () => { const a = document.activeElement; return a && (/INPUT|TEXTAREA|SELECT/.test(a.tagName) || a.isContentEditable); };

export function mountBoard(root, projectId){
  if (!getProject(projectId)) return { destroy(){} };
  if (!getProject(projectId).board) updateProject(projectId, () => {});
  const board = () => (getProject(projectId) || {}).board || { items: [], view: { x: 0, y: 0, z: 1 } };
  const fileMeta = id => ((getProject(projectId) || {}).files || []).find(f => f.id === id);
  const save = () => updateProject(projectId, () => {});

  /* ---- skeleton ---- */
  const head = el('div', 'pj-sec-head pj-board-bar');
  const tool = (label, title, svg) => {
    const b = el('button', 'tool-btn');
    b.type = 'button';
    b.title = title;
    b.innerHTML = '<svg viewBox="0 0 24 24">' + svg + '</svg>';
    b.append(label);
    return b;
  };
  const stickyBtn = tool('Sticky', 'New sticky (or double-click the board)', '<path d="M12 5v14M5 12h14"/>');
  const pick = el('div', 'color-pick');
  const swatch = el('button', 'swatch');
  swatch.type = 'button';
  swatch.title = 'Sticky color';
  pick.appendChild(swatch);
  const fileBtn = tool('File', 'Add files to the board (they are stored in Files too)', '<path d="M21 12.5l-8.5 8.5a5 5 0 0 1-7-7L14 5.5a3.3 3.3 0 0 1 4.7 4.7L10.2 18.7a1.7 1.7 0 0 1-2.4-2.4L15.5 8.6"/>');
  const placeBtn = tool('Place file', 'Put a file that is already in Files on the board', '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 12h6M12 9v6"/>');
  const pill = el('button', 'zoom-pill');
  pill.type = 'button';
  pill.title = 'Reset view';
  const input = el('input');
  input.type = 'file'; input.multiple = true; input.hidden = true;
  head.append(el('span', 'nav-label', 'Board'), stickyBtn, pick, fileBtn, placeBtn, pill, input);

  const stage = el('div', 'board-stage pj-board-stage');
  const world = el('div', 'board-world pj-board-world');
  const empty = el('div', 'board-empty');
  empty.append(el('span', 'be-big', 'A blank whiteboard.'), el('span', null, 'Double-click to add a sticky, or drop files here.'));
  stage.append(world, empty);
  root.append(head, stage);

  /* ---- view: pan + zoom ---- */
  const view = { x: 0, y: 0, z: 1, ...board().view };
  let viewTimer = null;
  function applyView(){
    world.style.transform = 'translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.z + ')';
    stage.style.backgroundSize = (26 * view.z) + 'px ' + (26 * view.z) + 'px';
    stage.style.backgroundPosition = view.x + 'px ' + view.y + 'px';
    pill.textContent = Math.round(view.z * 100) + '%';
  }
  const flushView = () => {
    if (!viewTimer) return;
    clearTimeout(viewTimer); viewTimer = null;
    const b = board();
    b.view = { x: view.x, y: view.y, z: view.z };
    save();
  };
  const saveView = () => { clearTimeout(viewTimer); viewTimer = setTimeout(flushView, 400); };
  const toWorld = (cx, cy) => { const r = stage.getBoundingClientRect(); return { x: (cx - r.left - view.x) / view.z, y: (cy - r.top - view.y) / view.z }; };
  const center = () => { const r = stage.getBoundingClientRect(); return toWorld(r.left + r.width / 2, r.top + r.height / 2); };

  stage.addEventListener('wheel', e => {
    e.preventDefault();
    const r = stage.getBoundingClientRect();
    const cx = e.clientX - r.left, cy = e.clientY - r.top;
    const wx = (cx - view.x) / view.z, wy = (cy - view.y) / view.z;
    view.z = clamp(view.z * Math.exp(-e.deltaY * 0.0015), 0.25, 2.5);
    view.x = cx - wx * view.z; view.y = cy - wy * view.z;
    applyView(); saveView();
  }, { passive: false });
  pill.addEventListener('click', () => { view.x = view.y = 0; view.z = 1; applyView(); saveView(); });

  /* ---- items ---- */
  const els = new Map();     // item id → element
  const urls = new Map();    // file id → object URL
  let selected = null;

  function place(d, it){
    d.style.left = it.x + 'px';
    d.style.top = it.y + 'px';
    d.style.width = it.w + 'px';
    d.style.height = it.h ? it.h + 'px' : 'auto';
  }

  function buildSticky(it){
    const d = el('div', 'sticky pj-item pj-sticky' + (isDark(it.color) ? ' dark' : ''));
    d.style.background = it.color;
    const del = el('button', 's-del', '×');
    del.type = 'button';
    del.title = 'Delete sticky';
    const text = el('div', 's-text');
    text.textContent = it.text || '';
    d.append(del, text, el('div', 's-resize'));
    text.addEventListener('keydown', e => { if (e.key === 'Escape'){ e.preventDefault(); text.blur(); } });
    text.addEventListener('paste', e => {
      e.preventDefault();
      document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
    });
    text.addEventListener('blur', () => {
      text.contentEditable = 'false';
      const v = text.innerText.replace(/\n$/, '');
      if (v !== (it.text || '')){ it.text = v; save(); }
    });
    return d;
  }

  function buildFile(it, f){
    const img = isImage(f);
    const d = el('div', 'pj-item pj-bfile' + (img ? ' img' : ''));
    d.style.setProperty('--kc', kindColor(f));
    d.title = f.name + ' · ' + sizeLabel(f.size) + '\nDouble-click to open';
    const del = el('button', 's-del', '×');
    del.type = 'button';
    del.title = 'Remove from the board (the file stays in Files)';
    d.appendChild(del);
    if (img){
      const pic = el('img');
      pic.alt = f.name;
      pic.draggable = false;
      d.append(pic, el('span', 'pj-bfile-cap', f.name));
      loadImage(it, f, pic, d);
    } else {
      const info = el('div', 'pj-bfile-info');
      info.append(el('span', 'fl-name', f.name), el('span', 'fl-meta', sizeLabel(f.size)));
      d.append(el('span', 'fl-ext', extOf(f.name)), info);
    }
    d.appendChild(el('div', 's-resize'));
    return d;
  }
  async function loadImage(it, f, pic, d){
    try {
      if (!urls.has(f.id)){
        const blob = await getFileBlob(f.id);
        if (!blob){ d.classList.add('missing'); pic.replaceWith(el('span', 'fl-ext', 'missing')); return; }
        urls.set(f.id, URL.createObjectURL(blob));
      }
      pic.onload = () => {
        if (!it.h && pic.naturalWidth){        // first time: take the picture's shape
          it.h = Math.round(it.w * pic.naturalHeight / pic.naturalWidth);
          place(d, it);
          save();
        }
      };
      pic.src = urls.get(f.id);
    } catch { pic.replaceWith(el('span', 'fl-ext', extOf(f.name))); }
  }

  function render(){
    world.innerHTML = '';
    els.clear();
    const b = board();
    /* file cards whose file was deleted are dropped */
    const before = b.items.length;
    b.items = b.items.filter(it => it.kind !== 'file' || fileMeta(it.fileId));
    if (b.items.length !== before) save();
    b.items.forEach(it => {
      const d = it.kind === 'sticky' ? buildSticky(it) : buildFile(it, fileMeta(it.fileId));
      d.dataset.id = it.id;
      d.classList.toggle('selected', it.id === selected);
      place(d, it);
      world.appendChild(d);
      els.set(it.id, d);
    });
    empty.hidden = b.items.length > 0;
  }
  const find = id => board().items.find(i => i.id === id);

  function select(id){
    if (selected && els.get(selected)) els.get(selected).classList.remove('selected');
    selected = id;
    if (id && els.get(id)) els.get(id).classList.add('selected');
  }
  function toFront(it){
    const b = board();
    const i = b.items.indexOf(it);
    if (i < 0 || i === b.items.length - 1) return;
    b.items.splice(i, 1); b.items.push(it);
    world.appendChild(els.get(it.id));
  }
  function beginEdit(id){
    const d = els.get(id);
    const text = d && d.querySelector('.s-text');
    if (!text) return;
    select(id);
    text.contentEditable = 'true';
    text.focus();
    const r = document.createRange();
    r.selectNodeContents(text); r.collapse(false);
    getSelection().removeAllRanges(); getSelection().addRange(r);
  }
  const stopEditing = () => { const a = document.activeElement; if (a && a.isContentEditable && world.contains(a)) a.blur(); };

  /* the free spot nearest to `at` (a w × h box centered there), searched in rings
     around it — for things added from the toolbar, so they don't pile up */
  function freeSpot(at, w, h){
    const boxes = [...els.values()].map(d => ({ x: d.offsetLeft, y: d.offsetTop, w: d.offsetWidth, h: d.offsetHeight }));
    const M = 18;
    const free = (x, y) => boxes.every(b => x + w + M <= b.x || b.x + b.w + M <= x || y + h + M <= b.y || b.y + b.h + M <= y);
    for (let ring = 0; ring < 14; ring++){
      const steps = ring ? ring * 8 : 1;
      for (let s = 0; s < steps; s++){
        const a = (s / steps) * Math.PI * 2;
        const x = Math.round(at.x - w / 2 + Math.cos(a) * ring * 60), y = Math.round(at.y - h / 2 + Math.sin(a) * ring * 60);
        if (free(x, y)) return { x: x + w / 2, y: y + h / 2 };
      }
    }
    return at;
  }

  function addSticky(at, edit = true){
    const it = { id: uid(), kind: 'sticky', x: Math.round(at.x - STICKY.w / 2), y: Math.round(at.y - STICKY.h / 2), w: STICKY.w, h: STICKY.h, color: activeColor, text: '' };
    board().items.push(it);
    save(); render();
    if (edit) beginEdit(it.id); else select(it.id);
  }
  /* exact: put them where asked (a drop); otherwise each finds a free spot near `at` */
  function placeFiles(metas, at, exact = false){
    if (!metas.length) return;
    const b = board();
    metas.forEach((f, i) => {
      const img = isImage(f);
      const w = img ? IMG.w : CARD.w, h = img ? IMG.w * 0.75 : CARD.h;   // an image's height is known once loaded
      const c = exact ? { x: at.x + i * 26, y: at.y + i * 26 } : freeSpot(at, w, h);
      const it = { id: uid(), kind: 'file', fileId: f.id, x: Math.round(c.x - w / 2), y: Math.round(c.y - h / 2), w, h: img ? null : CARD.h };
      b.items.push(it);
      /* a stand-in box, so the next file of the batch avoids this one */
      if (!exact){ const ghost = el('div'); Object.assign(ghost.style, { position: 'absolute', left: it.x + 'px', top: it.y + 'px', width: w + 'px', height: h + 'px' }); world.appendChild(ghost); els.set(it.id, ghost); }
    });
    save(); render();
    select(b.items[b.items.length - 1].id);
  }
  async function uploadAt(list, at, exact){
    const metas = await addFiles(projectId, list);
    if (metas.length && stage.isConnected) placeFiles(metas, at, exact);
  }
  function removeItem(id){
    const it = find(id);
    if (!it) return;
    board().items = board().items.filter(i => i.id !== id);
    if (selected === id) selected = null;
    save(); render();
    if (it.kind === 'file') toast('Removed from the board — “' + (fileMeta(it.fileId) || {}).name + '” is still in Files');
  }

  /* ---- pointer: move, resize, pan ---- */
  let act = null;
  stage.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    suppressClick = false;
    const d = e.target.closest('.pj-item');
    if (e.target.closest('.s-del') || e.target.isContentEditable) return;
    stopEditing();
    if (!d){
      select(null);
      act = { mode: 'pan', sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y };
      stage.classList.add('panning');
    } else {
      const it = find(d.dataset.id);
      if (!it) return;
      select(it.id); toFront(it);
      act = { mode: e.target.closest('.s-resize') ? 'resize' : 'move', it, d, sx: e.clientX, sy: e.clientY,
              ox: it.x, oy: it.y, ow: it.w, oh: it.h || d.offsetHeight, moved: false };
      d.classList.add('dragging');
    }
    /* an item captures only once it really moves: captured, a double-click would land on the stage */
    if (act.mode === 'pan') stage.setPointerCapture(e.pointerId);
    act.pointerId = e.pointerId;
    e.preventDefault();
  });
  stage.addEventListener('pointermove', e => {
    if (!act) return;
    if (act.mode === 'pan'){
      view.x = act.ox + e.clientX - act.sx; view.y = act.oy + e.clientY - act.sy;
      applyView();
      return;
    }
    const dx = (e.clientX - act.sx) / view.z, dy = (e.clientY - act.sy) / view.z;
    if (!act.moved && Math.hypot(dx, dy) < 3) return;
    if (!act.moved) stage.setPointerCapture(act.pointerId);
    act.moved = true;
    const { it } = act;
    if (act.mode === 'move'){ it.x = Math.round(act.ox + dx); it.y = Math.round(act.oy + dy); }
    else if (it.kind === 'sticky'){
      it.w = Math.round(clamp(act.ow + dx, STICKY.minW, STICKY.maxW));
      it.h = Math.round(clamp(act.oh + dy, STICKY.minH, STICKY.maxH));
    } else if (act.d.classList.contains('img')){
      it.w = Math.round(clamp(act.ow + dx, IMG.minW, IMG.maxW));
      it.h = Math.round(it.w * act.oh / act.ow);       // keeps the picture's shape
    } else {
      it.w = Math.round(clamp(act.ow + dx, CARD.minW, CARD.maxW));
      it.h = Math.round(clamp(act.oh + dy, CARD.minH, CARD.maxH));
    }
    place(act.d, it);
  });
  const endAct = e => {
    if (!act) return;
    const a = act;
    act = null;
    stage.releasePointerCapture?.(e.pointerId);
    stage.classList.remove('panning');
    if (a.mode === 'pan'){ saveView(); return; }
    a.d.classList.remove('dragging');
    save();     // position, size or stacking order
    if (a.moved) suppressClick = true;
  };
  stage.addEventListener('pointerup', endAct);
  stage.addEventListener('pointercancel', endAct);

  let suppressClick = false;
  stage.addEventListener('click', e => {
    if (suppressClick){ suppressClick = false; return; }
    const del = e.target.closest('.s-del');
    if (del) removeItem(del.closest('.pj-item').dataset.id);
  });
  stage.addEventListener('dblclick', e => {
    if (e.target.closest('.s-del')) return;
    const d = e.target.closest('.pj-item');
    if (!d){ addSticky(toWorld(e.clientX, e.clientY)); return; }
    const it = find(d.dataset.id);
    if (!it) return;
    if (it.kind === 'sticky') beginEdit(it.id);
    else { const f = fileMeta(it.fileId); if (f) openFile(f); }
  });

  /* ---- right-click menus ---- */
  function placeMenu(x, y, at){
    const fs = (getProject(projectId) || {}).files || [];
    if (!fs.length){ toast('No files yet — add some with + File, or drop them on the board'); return; }
    const onBoard = new Set(board().items.map(i => i.fileId).filter(Boolean));
    const sorted = fs.slice().sort((a, b) => onBoard.has(a.id) - onBoard.has(b.id)).slice(0, 12);
    showContextMenu(x, y, sorted.map(f => ({
      label: (isImage(f) ? '▣ ' : '▤ ') + f.name + (onBoard.has(f.id) ? '  · on board' : ''),
      action: () => placeFiles([f], at)
    })));
  }
  stage.addEventListener('contextmenu', e => {
    e.preventDefault();
    const d = e.target.closest('.pj-item');
    const at = toWorld(e.clientX, e.clientY);
    if (!d){
      showContextMenu(e.clientX, e.clientY, [
        { label: 'New sticky here', action: () => addSticky(at) },
        { label: 'Add files here…', action: () => { pendingAt = at; input.click(); } },
        { label: 'Place a file from Files here…', action: () => placeMenu(e.clientX, e.clientY, at) }
      ]);
      return;
    }
    const it = find(d.dataset.id);
    if (!it) return;
    select(it.id);
    if (it.kind === 'sticky'){
      showContextMenu(e.clientX, e.clientY, [
        { label: 'Edit text', action: () => beginEdit(it.id) },
        { label: 'Use the current color', action: () => { it.color = activeColor; save(); render(); } },
        { label: 'Duplicate', action: () => { board().items.push({ ...it, id: uid(), x: it.x + 24, y: it.y + 24 }); save(); render(); } },
        { label: 'Delete sticky', danger: true, action: () => removeItem(it.id) }
      ]);
    } else {
      const f = fileMeta(it.fileId);
      showContextMenu(e.clientX, e.clientY, [
        { label: 'Open', action: () => openFile(f) },
        { label: 'Download', action: () => downloadFile(f) },
        { label: 'Remove from board', action: () => removeItem(it.id) },
        { label: 'Delete file', danger: true, action: () => {
          if (confirm('Delete “' + f.name + '” from the project? It disappears from the board and from Files.')){ deleteFile(projectId, f); render(); }
        } }
      ]);
    }
  });

  /* ---- toolbar ---- */
  const showSwatch = () => { swatch.style.background = activeColor; };
  const destroyWheel = attachColorWheel(swatch, () => activeColor, hex => {
    activeColor = hex;
    store.set('ideally.projectStickyColor', hex);
    showSwatch();
    const it = selected && find(selected);
    if (it && it.kind === 'sticky'){
      it.color = hex;
      const d = els.get(it.id);
      d.style.background = hex;
      d.classList.toggle('dark', isDark(hex));
      save();
    }
  });
  /* the color wheel is a click away from the board: keep the sticky selected */
  swatch.addEventListener('pointerdown', e => e.stopPropagation());
  stickyBtn.addEventListener('click', () => addSticky(freeSpot(center(), STICKY.w, STICKY.h)));
  let pendingAt = null;
  fileBtn.addEventListener('click', () => { pendingAt = null; input.click(); });
  input.addEventListener('change', () => {
    const list = [...input.files];
    input.value = '';
    if (list.length) uploadAt(list, pendingAt || center(), !!pendingAt);
    pendingAt = null;
  });
  placeBtn.addEventListener('click', () => { const r = placeBtn.getBoundingClientRect(); placeMenu(r.left, r.bottom + 6, center()); });

  /* ---- keys: Delete / Backspace removes the selected item, Enter edits a sticky ---- */
  const onKey = e => {
    if (!selected || editing() || !stage.isConnected || !stage.offsetParent) return;
    if (e.key === 'Delete' || e.key === 'Backspace'){ e.preventDefault(); removeItem(selected); }
    else if (e.key === 'Enter' && find(selected)?.kind === 'sticky'){ e.preventDefault(); beginEdit(selected); }
  };
  document.addEventListener('keydown', onKey);

  showSwatch(); applyView(); render();

  return {
    destroy(){
      stopEditing(); flushView();
      document.removeEventListener('keydown', onKey);
      destroyWheel();
      urls.forEach(u => URL.revokeObjectURL(u)); urls.clear();
    },
    /* files dropped on the page: where they were dropped if that's on the board, else in the middle */
    dropFiles(list, cx, cy){
      const r = stage.getBoundingClientRect();
      const inside = cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
      uploadAt(list, inside ? toWorld(cx, cy) : center(), inside);
    },
    pasteFiles: list => uploadAt(list, center())
  };
}
