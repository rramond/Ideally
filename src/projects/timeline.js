import { clamp } from '../lib/utils.js';
import { dayNumber, isoDate } from '../lib/dates.js';
import { showContextMenu } from '../lib/contextMenu.js';
import { toast } from '../lib/toast.js';
import { updateProject } from './projects.js';
import { itemRange, shiftWhen, whenLabel, shortWhen, isoOf, statusOf, goalOf, progressOf, byWhen, today as todayNum } from './roadmap.js';

/* ============================================================
   ROADMAP · TIMELINE (2d, 2h) — the items on a horizontal axis
   with a glowing today line. One-day items are milestones (a
   diamond on the axis), spans are bars, months / quarters are
   soft dashed bands. Colored by status; the goal's dot and the
   steps' progress show on the label. Items sit in lanes above /
   below the axis so labels never overlap.
   - drag an item to move it (days snap to days, months / quarters
     to the month / quarter they land in); drag a span's right edge
     to change its end
   - click opens it in the side panel; right-click: Open / Done /
     Delete; double-click (or right-click) empty space makes one
   - wheel scrolls in time, Shift+wheel up / down, Ctrl+wheel zooms
============================================================ */
const el = (tag, cls, text) => {
  const x = document.createElement(tag);
  if (cls) x.className = cls;
  if (text != null) x.textContent = text;
  return x;
};
const ZOOMS = [2, 4, 6, 9, 13, 18, 26, 38, 56];   // px per day
const RULER = 38, PAD = 18, LANE_H = 34, CHIP_H = 24, STEM = 14, LANE_GAP = 10;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* text widths, for the lanes */
const measureCtx = document.createElement('canvas').getContext('2d');
const textW = (s, font) => { measureCtx.font = font; return measureCtx.measureText(s).width; };
const CHIP_FONT = '600 12.5px Inter, system-ui, sans-serif';

let zoomIndex = 5;   // shared by every project while the app is open

export function mountTimeline(host, ctx){
  /* controls, in the roadmap's toolbar */
  const zoom = el('div', 'tl-zoom');
  const zOut = el('button', 'icon-btn', '−'), zLabel = el('span', 'tl-zoom-label'), zIn = el('button', 'icon-btn', '+');
  zOut.title = 'Zoom out (Ctrl+wheel)'; zIn.title = 'Zoom in (Ctrl+wheel)';
  zoom.append(zOut, zLabel, zIn);
  const todayBtn = el('button', 'ghost-btn pj-small-btn', 'Today');
  [zOut, zIn, todayBtn].forEach(b => { b.type = 'button'; });
  ctx.slot.append(zoom, todayBtn);

  const scroll = el('div', 'tl-scroll');
  const world = el('div', 'tl-world');
  scroll.appendChild(world);
  host.appendChild(scroll);

  const dayW = () => ZOOMS[zoomIndex];
  let startDay = 0, axisY = 0;
  const xOfDay = d => (d - startDay) * dayW();
  const dayAt = x => startDay + Math.floor(x / dayW());

  /* ---- layout + drawing ---- */
  function render(){
    const p = ctx.project();
    if (!p) return;
    const its = ctx.items();
    const today = todayNum();
    const created = dayNumber(isoDate(new Date(p.created || Date.now())));
    const days = its.flatMap(it => itemRange(it.when));
    startDay = Math.min(today, created, ...days) - 14;
    let endDay = Math.max(today, ...days) + 45;
    const w = dayW();
    endDay = Math.max(endDay, startDay + Math.ceil((scroll.clientWidth || 800) / w) + 1);
    const width = (endDay - startDay) * w;

    /* lanes: greedy, alternating above (even) and below (odd) the axis */
    const placed = its.slice().sort(byWhen).map(it => {
      const [a, b] = itemRange(it.when);
      const x0 = xOfDay(a);
      const mile = it.when.kind === 'day' && !it.when.end;
      const labelW = textW(it.name, CHIP_FONT) + 70;      // name + date + goal dot + padding
      const barW = (b - a + 1) * w;
      const inside = !mile && labelW <= barW;
      const left = mile ? x0 + w / 2 - 10 : x0;
      const right = mile ? left + labelW : x0 + barW + (inside ? 0 : labelW + 6);
      return { it, x0, barW, mile, inside, left, right, lane: 0 };
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

    /* ruler: months (quarters when zoomed far out), then days / weeks depending on the zoom */
    for (let d = startDay; d < endDay; d++){
      const iso = isoOf(d), x = (d - startDay) * w, dom = +iso.slice(8, 10), mon = +iso.slice(5, 7);
      const dow = new Date(d * 86400000).getUTCDay();
      if (dom === 1 || d === startDay){
        const m = el('div', 'tl-month' + ((mon - 1) % 3 === 0 ? ' q' : ''));
        m.style.left = x + 'px';
        m.textContent = w >= 4 || (mon - 1) % 3 === 0 || d === startDay ? MONTHS[mon - 1] + (w >= 4 || mon === 1 || d === startDay ? ' ' + iso.slice(0, 4) : '') : '';
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

    placed.forEach(pl => world.appendChild(drawItem(pl, p, w)));
    if (!its.length){
      const hint = el('div', 'tl-hint', ctx.filtering() ? 'No items match the search / filter' : 'Double-click the timeline (or use + Item) to mark the first step');
      hint.style.left = ((today - startDay) * w + w / 2) + 'px';
      world.appendChild(hint);
    }
    zLabel.textContent = w >= 18 ? 'days' : w >= 6 ? 'weeks' : w >= 4 ? 'months' : 'quarters';
    zOut.disabled = zoomIndex === 0; zIn.disabled = zoomIndex === ZOOMS.length - 1;
  }

  function drawItem(pl, p, w){
    const { it, x0, barW, mile, inside, lane } = pl;
    const above = lane % 2 === 0, level = Math.floor(lane / 2);
    const chipTop = above ? axisY - STEM - CHIP_H - level * LANE_H : axisY + STEM + 6 + level * LANE_H;
    const st = statusOf(it), g = goalOf(p, it), pr = progressOf(it);
    const rough = it.when.kind !== 'day';
    const gEl = el('div', 'tl-item' + (mile ? ' mile' : ' span') + (rough ? ' rough' : '') + (it.status === 'done' ? ' done' : '') + (ctx.isOpen(it.id) ? ' open' : ''));
    gEl.dataset.id = it.id;
    gEl.style.setProperty('--ic', st.color);

    const cx = mile ? x0 + w / 2 : x0;
    const stem = el('div', 'tl-stem');
    stem.style.left = cx + 'px';
    stem.style.top = (above ? chipTop + CHIP_H : axisY) + 'px';
    stem.style.height = (above ? axisY - chipTop - CHIP_H : chipTop - axisY) + 'px';
    gEl.appendChild(stem);

    if (mile){
      const dot = el('div', 'tl-dot');
      dot.style.left = cx + 'px';
      gEl.appendChild(dot);
    } else {
      const band = el('div', 'tl-band');
      band.style.left = x0 + 'px'; band.style.width = barW + 'px';
      gEl.appendChild(band);
    }

    const chip = el('div', 'tl-chip');
    chip.tabIndex = 0;
    chip.style.top = chipTop + 'px';
    chip.style.left = (mile ? cx - 10 : x0) + 'px';
    if (!mile){ chip.style.width = barW + 'px'; if (!inside) chip.classList.add('outside'); }
    const label = el('span', 'tl-chip-label');
    if (g){ const gd = el('i', 'tl-goal-dot'); gd.style.background = g.color; gd.title = g.name; label.appendChild(gd); }
    label.append(el('b', null, (it.status === 'done' ? '✓ ' : '') + it.name), el('small', null, shortWhen(it.when)));
    chip.appendChild(label);
    if (pr){
      const bar = el('span', 'tl-chip-prog');
      bar.style.width = (pr.done / pr.total * 100) + '%';
      chip.appendChild(bar);
    }
    chip.title = it.name + ' · ' + whenLabel(it.when) + ' · ' + st.label + (g ? ' · ' + g.name : '') + (pr ? ' · ' + pr.done + '/' + pr.total + ' steps' : '') +
                 (it.desc ? '\n' + it.desc : '') + '\nDrag to move · click to open';
    if (!mile && !rough){
      const grip = el('span', 'tl-grip');
      grip.title = 'Drag to change the end';
      chip.appendChild(grip);
    }
    gEl.appendChild(chip);
    return gEl;
  }

  /* ---- actions ---- */
  const getItem = id => ctx.all().find(x => x.id === id);
  const createOn = iso => ctx.create({ when: { kind: 'day', date: iso, end: null } }, true);
  const itemMenu = (x, y, id) => {
    const it = getItem(id);
    if (!it) return;
    showContextMenu(x, y, [
      { label: 'Open', action: () => ctx.open(id) },
      { label: it.status === 'done' ? 'Mark as pending' : 'Mark as done', action: () => ctx.update(id, i => { i.status = i.status === 'done' ? 'pending' : 'done'; }) },
      { label: 'Delete', danger: true, action: () => {
        updateProject(ctx.projectId, p => { p.timeline = p.timeline.filter(i => i.id !== id); });
        ctx.update(id, () => {});
        toast('Deleted “' + it.name + '”');
      } }
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
  todayBtn.addEventListener('click', () => scrollToDay(todayNum(), true));

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
    const w = dayW(), wh = drag.it.when;
    let delta = Math.round(dx / w);
    const [a0, b0] = itemRange(wh);
    let next;
    if (drag.mode === 'end'){
      delta = Math.max(delta, a0 - b0 + 1);          // at least two days long
      next = { kind: 'day', date: wh.date, end: isoOf(b0 + delta) };
    } else next = shiftWhen(wh, delta);
    drag.next = next;
    const [a, b] = itemRange(next);
    if (drag.mode === 'move') drag.g.style.transform = 'translateX(' + (a - a0) * w + 'px)';
    else {
      const barW = (b - a + 1) * w;
      drag.g.querySelector('.tl-chip').style.width = barW + 'px';
      drag.g.querySelector('.tl-band').style.width = barW + 'px';
    }
    drag.tag.textContent = whenLabel(next);
    drag.tag.style.left = (drag.mode === 'end' ? xOfDay(b + 1) : xOfDay(a) + (next.kind === 'day' && !next.end ? w / 2 : 0)) + 'px';
  });
  const endDrag = e => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (!d.moved){ if (e.type === 'pointerup') ctx.open(d.id); return; }
    scroll.releasePointerCapture?.(d.pointerId);
    const keepDay = scroll.scrollLeft / dayW() + startDay;
    if (e.type === 'pointerup' && d.next && JSON.stringify(d.next) !== JSON.stringify(d.it.when)) ctx.update(d.id, it => { it.when = d.next; });
    else render();
    scroll.scrollLeft = (keepDay - startDay) * dayW();
  };
  scroll.addEventListener('pointerup', endDrag);
  scroll.addEventListener('pointercancel', endDrag);
  scroll.addEventListener('dblclick', e => {
    if (e.target.closest('.tl-item')) return;
    const r = world.getBoundingClientRect();
    createOn(isoOf(dayAt(e.clientX - r.left)));
  });
  scroll.addEventListener('contextmenu', e => {
    e.preventDefault();
    const g = e.target.closest('.tl-item');
    if (g){ itemMenu(e.clientX, e.clientY, g.dataset.id); return; }
    const r = world.getBoundingClientRect();
    const iso = isoOf(dayAt(e.clientX - r.left));
    showContextMenu(e.clientX, e.clientY, [{ label: 'New item on ' + iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(2, 4), action: () => createOn(iso) }]);
  });
  scroll.addEventListener('keydown', e => {
    const chip = e.target.closest('.tl-chip');
    if (chip && e.key === 'Enter'){ e.preventDefault(); ctx.open(chip.closest('.tl-item').dataset.id); }
  });

  /* first paint once the view has its size; later size changes (the side panel) keep the date in view */
  let first = true;
  const ro = new ResizeObserver(() => {
    if (!scroll.clientWidth) return;
    const keepDay = scroll.scrollLeft / dayW() + startDay;
    render();
    if (first){ first = false; scrollToDay(todayNum(), false); }
    else scroll.scrollLeft = (keepDay - startDay) * dayW();
  });
  ro.observe(scroll);

  return {
    render(){
      if (!scroll.clientWidth) return;     // the first paint waits for the size
      const keepDay = scroll.scrollLeft / dayW() + startDay;
      render();
      scroll.scrollLeft = (keepDay - startDay) * dayW();
    },
    destroy(){ ro.disconnect(); }
  };
}
