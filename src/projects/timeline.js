import { clamp } from '../lib/utils.js';
import { dayNumber, isoDate } from '../lib/dates.js';
import { showContextMenu } from '../lib/contextMenu.js';
import { toast } from '../lib/toast.js';
import { getProject, updateProject } from './projects.js';
import { openMilestoneEditor } from './milestoneEditor.js';

/* ============================================================
   PROJECT TIMELINE (2d) — the project's milestones (one day) and
   spans (several days) on a horizontal axis, with a glowing
   today line. Items sit in lanes above and below the axis so
   their labels never overlap.
   - drag an item along the axis to move it (snaps to days); drag
     a span's right edge to change its end
   - click opens it, right-click: Edit / Done / Delete; double-
     click (or right-click) empty space makes one on that day
   - wheel scrolls in time, Shift+wheel up/down, Ctrl+wheel zooms
   Below: the same items as a checklist in date order.
============================================================ */
const el = (tag, cls, text) => {
  const x = document.createElement(tag);
  if (cls) x.className = cls;
  if (text != null) x.textContent = text;
  return x;
};
const ZOOMS = [4, 6, 9, 13, 18, 26, 38, 56];   // px per day
const RULER = 38, PAD = 18, LANE_H = 34, CHIP_H = 24, STEM = 14, LANE_GAP = 10;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const isoOf = n => new Date(n * 86400000).toISOString().slice(0, 10);
const ddmm = iso => iso.slice(8, 10) + '.' + iso.slice(5, 7);
const ddmmyy = iso => ddmm(iso) + '.' + iso.slice(2, 4);
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
const rangeLabel = it => it.end ? ddmm(it.date) + ' – ' + ddmmyy(it.end) : ddmmyy(it.date);

/* "today", "in 3 days", "2 days late", "ongoing", "done" */
function relLabel(it, today){
  if (it.done) return { text: 'done', cls: 'done' };
  const a = dayNumber(it.date), b = dayNumber(it.end || it.date);
  if (today >= a && today <= b) return it.end ? { text: 'ongoing · ' + plural(b - today + 1, 'day') + ' left', cls: 'now' } : { text: 'today', cls: 'now' };
  if (today < a) return { text: a - today === 1 ? 'tomorrow' : 'in ' + plural(a - today, 'day'), cls: '' };
  return { text: plural(today - b, 'day') + ' late', cls: 'late' };
}

/* text widths, for the lanes */
const measureCtx = document.createElement('canvas').getContext('2d');
const textW = (s, font) => { measureCtx.font = font; return measureCtx.measureText(s).width; };
const CHIP_FONT = '600 12.5px Inter, system-ui, sans-serif';

let zoomIndex = 4;   // shared by every project while the app is open

export function mountTimeline(root, projectId){
  /* ---- skeleton ---- */
  const head = el('div', 'pj-sec-head');
  const progress = el('div', 'tl-progress');
  const progBar = el('span', 'tl-prog-bar'), progFill = el('i'), progText = el('span', 'tl-prog-text');
  progBar.appendChild(progFill);
  progress.append(progBar, progText);
  const zoom = el('div', 'tl-zoom');
  const zOut = el('button', 'icon-btn', '−'), zLabel = el('span', 'tl-zoom-label'), zIn = el('button', 'icon-btn', '+');
  zOut.title = 'Zoom out (Ctrl+wheel)'; zIn.title = 'Zoom in (Ctrl+wheel)';
  zoom.append(zOut, zLabel, zIn);
  const todayBtn = el('button', 'ghost-btn pj-small-btn', 'Today');
  const newBtn = el('button', 'ghost-btn pj-small-btn', '+ Milestone');
  [zOut, zIn, todayBtn, newBtn].forEach(b => { b.type = 'button'; });
  head.append(el('span', 'nav-label', 'Timeline'), progress, el('span', 'pj-grow'), zoom, todayBtn, newBtn);

  const scroll = el('div', 'tl-scroll');
  const world = el('div', 'tl-world');
  scroll.appendChild(world);
  const list = el('div', 'tl-list');
  root.append(head, scroll, list);

  const items = () => (getProject(projectId) || {}).timeline || [];
  const dayW = () => ZOOMS[zoomIndex];
  let startDay = 0, axisY = 0;
  const xOf = iso => (dayNumber(iso) - startDay) * dayW();
  const dayAt = x => startDay + Math.floor(x / dayW());

  /* ---- layout + drawing ---- */
  function render(){
    const its = items(), p = getProject(projectId);
    if (!p) return;
    const today = dayNumber(isoDate(new Date()));
    const created = dayNumber(isoDate(new Date(p.created || Date.now())));
    const days = its.flatMap(it => [dayNumber(it.date), dayNumber(it.end || it.date)]);
    startDay = Math.min(today, created, ...days) - 14;
    let endDay = Math.max(today, ...days) + 45;
    const w = dayW();
    endDay = Math.max(endDay, startDay + Math.ceil((scroll.clientWidth || 800) / w) + 1);
    const width = (endDay - startDay) * w;

    /* lanes: greedy, alternating above (even) and below (odd) the axis */
    const placed = its.slice().sort((a, b) => a.date.localeCompare(b.date) || (b.end || '').localeCompare(a.end || ''))
      .map(it => {
        const x0 = xOf(it.date);
        const labelW = textW(it.name, CHIP_FONT) + 60;      // name + date + padding
        const barW = it.end ? (dayNumber(it.end) - dayNumber(it.date) + 1) * w : 0;
        const inside = it.end && labelW <= barW;
        const left = it.end ? x0 : x0 + w / 2 - 10;
        const right = it.end ? x0 + barW + (inside ? 0 : labelW + 6) : left + labelW;
        return { it, x0, barW, inside, left, right, lane: 0 };
      });
    const laneEnds = [];
    placed.forEach(pl => {
      let lane = laneEnds.findIndex(end => end + LANE_GAP <= pl.left);
      if (lane < 0){ lane = laneEnds.length; laneEnds.push(0); }
      laneEnds[lane] = pl.right;
      pl.lane = lane;
    });
    const up = Math.ceil(laneEnds.length / 2), down = Math.floor(laneEnds.length / 2);
    let height = RULER + PAD + STEM + up * LANE_H + 6 + STEM + down * LANE_H + PAD;
    axisY = RULER + PAD + STEM + up * LANE_H;
    const avail = scroll.clientHeight || 260;
    if (height < avail){ axisY += Math.floor((avail - height) / 2); height = avail; }

    world.innerHTML = '';
    world.style.width = width + 'px';
    world.style.height = height + 'px';
    world.style.setProperty('--axis', axisY + 'px');

    /* ruler: months (with a faint line), then days / weeks depending on the zoom */
    for (let d = startDay; d < endDay; d++){
      const iso = isoOf(d), x = (d - startDay) * w, dom = +iso.slice(8, 10);
      const dow = new Date(d * 86400000).getUTCDay();
      if (dom === 1 || d === startDay){
        const m = el('div', 'tl-month');
        m.style.left = x + 'px';
        m.textContent = MONTHS[+iso.slice(5, 7) - 1] + ' ' + iso.slice(0, 4);
        world.appendChild(m);
      }
      if (w >= 9 && (dow === 0 || dow === 6)){
        const we = el('div', 'tl-weekend');
        we.style.left = x + 'px'; we.style.width = w + 'px';
        world.appendChild(we);
      }
      const showDay = w >= 18 || (w >= 6 && dow === 1);
      if (showDay){
        const t = el('div', 'tl-day' + (d === today ? ' today' : ''), String(dom));
        t.style.left = x + 'px'; t.style.width = (w >= 18 ? w : 7 * w) + 'px';
        if (w < 18) t.classList.add('week');
        world.appendChild(t);
      }
    }
    world.appendChild(el('div', 'tl-axis'));
    const now = el('div', 'tl-today');
    now.style.left = ((today - startDay) * w + w / 2) + 'px';
    now.appendChild(el('span', null, 'TODAY'));
    world.appendChild(now);

    /* items */
    placed.forEach(pl => world.appendChild(drawItem(pl, today, w)));
    if (!its.length){
      const hint = el('div', 'tl-hint', 'Double-click the timeline (or use + Milestone) to mark the first step');
      hint.style.left = ((today - startDay) * w + w / 2) + 'px';
      world.appendChild(hint);
    }

    /* header + checklist */
    const done = its.filter(i => i.done).length;
    progFill.style.width = (its.length ? done / its.length * 100 : 0) + '%';
    progText.textContent = its.length ? done + ' / ' + its.length + ' done' : 'nothing planned yet';
    zLabel.textContent = w >= 18 ? 'days' : w >= 9 ? 'weeks' : 'months';
    zOut.disabled = zoomIndex === 0; zIn.disabled = zoomIndex === ZOOMS.length - 1;
    renderList(today);
  }

  function drawItem(pl, today, w){
    const { it, x0, barW, inside, lane } = pl;
    const above = lane % 2 === 0, level = Math.floor(lane / 2);
    const chipTop = above ? axisY - STEM - CHIP_H - level * LANE_H : axisY + STEM + 6 + level * LANE_H;
    const rel = relLabel(it, today);
    const g = el('div', 'tl-item' + (it.end ? ' span' : ' mile') + (it.done ? ' done' : '') + (rel.cls === 'late' ? ' late' : '') + (rel.cls === 'now' ? ' now' : ''));
    g.dataset.id = it.id;

    const cx = it.end ? x0 : x0 + w / 2;
    /* the stem, from the axis to the label */
    const stem = el('div', 'tl-stem');
    stem.style.left = cx + 'px';
    stem.style.top = (above ? chipTop + CHIP_H : axisY) + 'px';
    stem.style.height = (above ? axisY - chipTop - CHIP_H : chipTop - axisY) + 'px';
    g.appendChild(stem);

    if (it.end){
      const band = el('div', 'tl-band');
      band.style.left = x0 + 'px'; band.style.width = barW + 'px';
      g.appendChild(band);
    } else {
      const dot = el('div', 'tl-dot');
      dot.style.left = cx + 'px';
      g.appendChild(dot);
    }

    const chip = el('div', 'tl-chip');
    chip.tabIndex = 0;
    chip.style.top = chipTop + 'px';
    chip.style.left = (it.end ? x0 : cx - 10) + 'px';
    if (it.end){ chip.style.width = barW + 'px'; if (!inside) chip.classList.add('outside'); }
    const label = el('span', 'tl-chip-label');
    label.append(el('b', null, (it.done ? '✓ ' : '') + it.name), el('small', null, it.end ? ddmm(it.date) + '–' + ddmm(it.end) : ddmm(it.date)));
    chip.appendChild(label);
    chip.title = it.name + ' · ' + rangeLabel(it) + ' · ' + rel.text + (it.desc ? '\n' + it.desc : '') + '\nDrag to move · click to open';
    if (it.end){
      const grip = el('span', 'tl-grip');
      grip.title = 'Drag to change the end';
      chip.appendChild(grip);
    }
    g.appendChild(chip);
    return g;
  }

  function renderList(today){
    list.innerHTML = '';
    const its = items().slice().sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
    if (!its.length) return;
    its.forEach(it => {
      const rel = relLabel(it, today);
      const row = el('div', 'tl-row' + (it.done ? ' done' : '') + (rel.cls ? ' ' + rel.cls : ''));
      row.dataset.id = it.id;
      row.tabIndex = 0;
      const check = el('button', 'tl-check');
      check.type = 'button';
      check.title = it.done ? 'Mark as not done' : 'Mark as done';
      check.setAttribute('aria-pressed', it.done ? 'true' : 'false');
      row.append(check, el('span', 'tl-row-name', it.name), el('span', 'tl-row-date', rangeLabel(it)), el('span', 'tl-row-rel', rel.text));
      list.appendChild(row);
    });
  }

  /* ---- actions ---- */
  const getItem = id => items().find(x => x.id === id);
  const edit = id => { const it = getItem(id); if (it) openMilestoneEditor(projectId, { ...it }, render); };
  const create = iso => openMilestoneEditor(projectId, { date: iso }, render);
  const toggleDone = id => { updateProject(projectId, p => { const it = p.timeline.find(x => x.id === id); if (it) it.done = !it.done; }); render(); };
  const remove = id => {
    const it = getItem(id);
    if (!it) return;
    updateProject(projectId, p => { p.timeline = p.timeline.filter(x => x.id !== id); });
    render();
    toast('Deleted “' + it.name + '”');
  };
  const itemMenu = (x, y, id) => {
    const it = getItem(id);
    if (!it) return;
    showContextMenu(x, y, [
      { label: 'Edit', action: () => edit(id) },
      { label: it.done ? 'Mark as not done' : 'Mark as done', action: () => toggleDone(id) },
      { label: 'Delete', danger: true, action: () => remove(id) }
    ]);
  };

  function scrollToDay(d, smooth){
    const left = (d - startDay) * dayW() - scroll.clientWidth * 0.3;
    scroll.scrollTo({ left: Math.max(0, left), behavior: smooth ? 'smooth' : 'auto' });
  }
  function setZoom(i, anchorX = scroll.clientWidth / 2){
    i = clamp(i, 0, ZOOMS.length - 1);
    if (i === zoomIndex) return;
    const at = (scroll.scrollLeft + anchorX) / dayW() + startDay;   // the day under the anchor stays put
    zoomIndex = i;
    render();
    scroll.scrollLeft = (at - startDay) * dayW() - anchorX;
  }
  zOut.addEventListener('click', () => setZoom(zoomIndex - 1));
  zIn.addEventListener('click', () => setZoom(zoomIndex + 1));
  todayBtn.addEventListener('click', () => scrollToDay(dayNumber(isoDate(new Date())), true));
  newBtn.addEventListener('click', () => create(isoDate(new Date())));

  scroll.addEventListener('wheel', e => {
    if (e.ctrlKey || e.metaKey){
      e.preventDefault();
      const r = scroll.getBoundingClientRect();
      setZoom(zoomIndex + (e.deltaY < 0 ? 1 : -1), e.clientX - r.left);
      return;
    }
    if (e.shiftKey) return;            // up / down through the lanes
    e.preventDefault();
    scroll.scrollLeft += e.deltaX + e.deltaY;
  }, { passive: false });

  /* ---- pointer: drag to move, drag the grip to resize, click to open ---- */
  let drag = null;
  scroll.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const g = e.target.closest('.tl-item');
    if (!g) return;
    const it = getItem(g.dataset.id);
    if (!it) return;
    drag = { id: it.id, g, it, x: e.clientX, moved: false, delta: 0,
             mode: e.target.closest('.tl-grip') ? 'end' : 'move', pointerId: e.pointerId };
    e.preventDefault();
  });
  scroll.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < 4) return;
    if (!drag.moved){
      drag.moved = true;
      scroll.setPointerCapture(drag.pointerId);
      drag.g.classList.add('dragging');
      drag.tag = el('div', 'tl-drag-tag');
      world.appendChild(drag.tag);
    }
    const w = dayW();
    let delta = Math.round(dx / w);
    if (drag.mode === 'end') delta = Math.max(delta, dayNumber(drag.it.date) - dayNumber(drag.it.end));   // never before the start
    drag.delta = delta;
    const start = drag.mode === 'move' ? dayNumber(drag.it.date) + delta : dayNumber(drag.it.date);
    const end = drag.it.end ? dayNumber(drag.it.end) + delta : null;
    if (drag.mode === 'move') drag.g.style.transform = 'translateX(' + delta * w + 'px)';
    else {
      const barW = (end - start + 1) * w;
      drag.g.querySelector('.tl-chip').style.width = barW + 'px';
      drag.g.querySelector('.tl-band').style.width = barW + 'px';
    }
    drag.tag.textContent = end != null ? ddmm(isoOf(start)) + ' – ' + ddmmyy(isoOf(end)) : ddmmyy(isoOf(start));
    drag.tag.style.left = ((drag.mode === 'end' ? end + 1 : start) - startDay) * w + (drag.mode === 'end' ? 0 : drag.it.end ? 0 : w / 2) + 'px';
  });
  const endDrag = e => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (!d.moved){ if (e.type === 'pointerup') edit(d.id); return; }
    scroll.releasePointerCapture?.(d.pointerId);
    if (d.delta && e.type === 'pointerup'){
      updateProject(projectId, p => {
        const it = p.timeline.find(x => x.id === d.id);
        if (!it) return;
        if (d.mode === 'move') it.date = isoOf(dayNumber(it.date) + d.delta);
        if (it.end) it.end = isoOf(dayNumber(it.end) + d.delta);
        if (it.end === it.date) it.end = null;
      });
    }
    const keep = scroll.scrollLeft, keepDay = keep / dayW() + startDay;
    render();
    scroll.scrollLeft = (keepDay - startDay) * dayW();
  };
  scroll.addEventListener('pointerup', endDrag);
  scroll.addEventListener('pointercancel', endDrag);
  /* a click after a drag shouldn't also count as a click on whatever is under it */
  scroll.addEventListener('dblclick', e => {
    if (e.target.closest('.tl-item')) return;
    const r = world.getBoundingClientRect();
    create(isoOf(dayAt(e.clientX - r.left)));
  });
  scroll.addEventListener('contextmenu', e => {
    e.preventDefault();
    const g = e.target.closest('.tl-item');
    if (g){ itemMenu(e.clientX, e.clientY, g.dataset.id); return; }
    const r = world.getBoundingClientRect();
    const iso = isoOf(dayAt(e.clientX - r.left));
    showContextMenu(e.clientX, e.clientY, [{ label: 'New milestone on ' + ddmmyy(iso), action: () => create(iso) }]);
  });
  scroll.addEventListener('keydown', e => {
    const chip = e.target.closest('.tl-chip');
    if (chip && e.key === 'Enter'){ e.preventDefault(); edit(chip.closest('.tl-item').dataset.id); }
  });

  /* checklist */
  list.addEventListener('click', e => {
    const row = e.target.closest('.tl-row');
    if (!row) return;
    if (e.target.closest('.tl-check')) toggleDone(row.dataset.id);
    else edit(row.dataset.id);
  });
  list.addEventListener('keydown', e => {
    const row = e.target.closest('.tl-row');
    if (row && e.key === 'Enter'){ e.preventDefault(); edit(row.dataset.id); }
    if (row && e.key === ' ' && e.target === row){ e.preventDefault(); toggleDone(row.dataset.id); }
  });
  list.addEventListener('contextmenu', e => {
    const row = e.target.closest('.tl-row');
    if (!row) return;
    e.preventDefault();
    itemMenu(e.clientX, e.clientY, row.dataset.id);
  });

  /* first paint once the section has its size */
  let first = true;
  const ro = new ResizeObserver(() => {
    if (!scroll.clientWidth) return;
    const keepDay = scroll.scrollLeft / dayW() + startDay;
    render();
    if (first){ first = false; scrollToDay(dayNumber(isoDate(new Date())), false); }
    else scroll.scrollLeft = (keepDay - startDay) * dayW();
  });
  ro.observe(scroll);

  return { destroy: () => ro.disconnect(), create: () => create(isoDate(new Date())) };
}
