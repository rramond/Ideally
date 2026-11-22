import { clamp, shade } from '../lib/utils.js';
import { themeColor, onThemeChange } from '../themes/theme.js';
import { showContextMenu } from '../lib/contextMenu.js';
import { toast } from '../lib/toast.js';
import { go, back, anyPopupOpen } from '../lib/history.js';
import { getProjects, getProject, contentCount, deleteProject, onProjectsChange } from './projects.js';
import { openProjectEditor } from './projectEditor.js';
import { playEntry } from './entryFx.js';

/* ============================================================
   PROJECTS HOMEPAGE (2b) — every project is a glassy droplet
   pulled toward the center (like the LoL mastery chart): live
   physics packs them, they drift gently and can be dragged
   (they spring back). Hovering one makes it wobble and bulge
   toward the cursor, glows its border and shows its name;
   clicking opens the project full screen. A "+" droplet makes
   a new project.
============================================================ */
const view = document.getElementById('view-projects');
const canvas = document.getElementById('pj-canvas');
const ctx = canvas.getContext('2d');
const hintEl = document.getElementById('pj-hint');
const page = document.getElementById('pj-page');

const PLUS = '+';                 // id of the "new project" droplet
const PULL = 2.4;                 // pull toward the center (per second)
const DRIFT = 7;                  // gentle wandering force
const GAP = 10;                   // px kept between droplets
const DRAG_START = 5;             // px a press must move before it becomes a drag

let W = 0, H = 0, dpr = 1;
let nodes = [];                   // { id, color, x, y, vx, vy, r, tr, hover, bulge, ang, wob, seed, t }
let pointer = { x: -1e4, y: -1e4, inside: false };
let hovered = null, press = null, dragging = null;
let raf = null, lastT = 0, active = false;
let accent = '#C084FC';

/* ---- sizes: a base size, growing with the content, capped by the window ---- */
function radii(){
  const m = Math.min(W, H);
  return { base: clamp(m * 0.075, 34, 84), max: m * 0.24 };
}
function targetRadius(id){
  const { base, max } = radii();
  if (id === PLUS) return base * 0.62;
  const p = getProject(id);
  return Math.min(max, base * (1 + 0.18 * Math.sqrt(p ? contentCount(p) : 0)));
}

/* rebuild the node list from the projects, keeping where existing droplets are;
   `scatter` throws every droplet out around the edges so they get pulled in */
function sync(scatter){
  const old = new Map(nodes.map(n => [n.id, n]));
  /* biggest first (then oldest), "+" last: on entry they arrive in this order, so the
     first takes the center and the rest pack around it (all at once, equal circles
     can jam into a ring around an empty middle) */
  const ids = [...getProjects()]
    .sort((a, b) => contentCount(b) - contentCount(a) || (a.created || 0) - (b.created || 0))
    .map(p => p.id).concat(PLUS);
  nodes = ids.map((id, i) => {
    let n = old.get(id);
    if (!n || scatter){
      const a = Math.random() * Math.PI * 2;
      const d = scatter ? Math.max(W, H) * (0.55 + Math.random() * 0.2) : 30 + Math.random() * 40;
      n = { ...(n || {}), id, x: W / 2 + Math.cos(a) * d, y: H / 2 + Math.sin(a) * d, vx: 0, vy: 0,
            r: n ? n.r : 4, hover: 0, bulge: 0, ang: 0, wob: 0.05, seed: Math.random() * 10, t: Math.random() * 10,
            wait: scatter ? i * 0.09 : 0 };
    }
    n.tr = targetRadius(id);
    n.color = id === PLUS ? accent : getProject(id).color;
    return n;
  });
  hintEl.hidden = getProjects().length > 0;
}

function resize(){
  dpr = window.devicePixelRatio || 1;
  W = view.clientWidth; H = view.clientHeight;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  nodes.forEach(n => { n.tr = targetRadius(n.id); });
}

/* ---- physics ---- */
function step(dt){
  const cx = W / 2, cy = H / 2;
  nodes.forEach(n => {
    n.t += dt;
    n.r += (n.tr - n.r) * Math.min(1, dt * 6);
    if (n.wait > 0){ n.wait -= dt; return; }        // still waiting for its turn to fly in
    if (n === dragging) return;
    n.vx += (cx - n.x) * PULL * dt + Math.cos(n.t * 0.7 + n.seed) * DRIFT * dt;
    n.vy += (cy - n.y) * PULL * dt + Math.sin(n.t * 0.9 + n.seed * 2) * DRIFT * dt;
  });
  /* push overlapping droplets apart (the dragged one doesn't yield) */
  for (let i = 0; i < nodes.length; i++){
    for (let j = i + 1; j < nodes.length; j++){
      const a = nodes[i], b = nodes[j];
      let dx = b.x - a.x, dy = b.y - a.y;
      let d = Math.hypot(dx, dy);
      const min = a.r + b.r + GAP;
      if (d >= min) continue;
      if (d < 0.01){ dx = Math.random() - 0.5; dy = Math.random() - 0.5; d = Math.hypot(dx, dy); }
      const nx = dx / d, ny = dy / d, overlap = min - d;
      const wa = a === dragging ? 0 : b === dragging ? 1 : 0.5, wb = 1 - wa;
      a.x -= nx * overlap * wa; a.y -= ny * overlap * wa;
      b.x += nx * overlap * wb; b.y += ny * overlap * wb;
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel < 0){
        if (a !== dragging){ a.vx += nx * rel * wa; a.vy += ny * rel * wa; }
        if (b !== dragging){ b.vx -= nx * rel * wb; b.vy -= ny * rel * wb; }
      }
    }
  }
  const damp = Math.pow(0.06, dt);
  nodes.forEach(n => {
    if (n !== dragging){
      n.vx *= damp; n.vy *= damp;
      n.x += n.vx * dt; n.y += n.vy * dt;
    }
    /* droplet state: hover fades in / out, the bulge leans toward the cursor,
       the wobble rings out after the cursor enters or leaves */
    const isHover = n === hovered;
    n.hover += ((isHover ? 1 : 0) - n.hover) * Math.min(1, dt * 9);
    if (isHover) n.ang = Math.atan2(pointer.y - n.y, pointer.x - n.x);
    const near = isHover ? clamp(1.25 - Math.hypot(pointer.x - n.x, pointer.y - n.y) / n.r, 0, 1) : 0;
    n.bulge += (0.075 * near - n.bulge) * Math.min(1, dt * 10);
    n.wob *= Math.exp(-2.6 * dt);
  });
}

/* ---- drawing ---- */
function blobPath(n){
  const N = 72;
  ctx.beginPath();
  for (let k = 0; k <= N; k++){
    const th = (k / N) * Math.PI * 2;
    const rr = n.r * (1
      + n.wob * (0.6 * Math.sin(3 * th + n.t * 7 + n.seed) + 0.4 * Math.sin(5 * th - n.t * 9))
      + n.bulge * Math.pow(Math.max(0, Math.cos(th - n.ang)), 4)
      + n.hover * 0.01 * Math.sin(4 * th + n.t * 3));
    const x = n.x + Math.cos(th) * rr, y = n.y + Math.sin(th) * rr;
    k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}

function drawDroplet(n){
  const c = n.color, r = n.r, plus = n.id === PLUS;
  ctx.save();
  blobPath(n);
  if (plus){
    /* the "+" droplet: a faint glassy ring in the theme accent */
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = c;
    ctx.fill();
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = c;
    ctx.shadowColor = c;
    ctx.shadowBlur = 6 + 14 * n.hover;
    ctx.globalAlpha = 0.6 + 0.4 * n.hover;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.fillStyle = c;
    const s = r * 0.42;
    ctx.fillRect(n.x - s / 2, n.y - 1.5, s, 3);
    ctx.fillRect(n.x - 1.5, n.y - s / 2, 3, s);
    ctx.restore();
    return;
  }

  /* glassy body: light center up-left, the project color, a darker rim */
  ctx.shadowColor = 'rgba(0,0,0,.35)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  const g = ctx.createRadialGradient(n.x - r * 0.35, n.y - r * 0.4, r * 0.05, n.x, n.y, r * 1.05);
  g.addColorStop(0, shade(c, 38));
  g.addColorStop(0.38, c);
  g.addColorStop(0.82, shade(c, -22));
  g.addColorStop(1, shade(c, -38));
  ctx.globalAlpha = 0.93;
  ctx.fillStyle = g;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.shadowColor = 'transparent';

  /* highlights inside the droplet */
  ctx.save();
  blobPath(n);
  ctx.clip();
  const h = ctx.createRadialGradient(n.x - r * 0.38, n.y - r * 0.46, 0, n.x - r * 0.38, n.y - r * 0.46, r * 0.42);
  h.addColorStop(0, 'rgba(255,255,255,.55)');
  h.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = h;
  ctx.fillRect(n.x - r, n.y - r, r * 2, r * 2);
  const h2 = ctx.createRadialGradient(n.x + r * 0.42, n.y + r * 0.5, 0, n.x + r * 0.42, n.y + r * 0.5, r * 0.5);
  h2.addColorStop(0, 'rgba(255,255,255,.14)');
  h2.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = h2;
  ctx.fillRect(n.x - r, n.y - r, r * 2.2, r * 2.2);
  ctx.restore();

  /* border: a thin light rim, glowing on hover */
  blobPath(n);
  ctx.lineWidth = 1.2 + 1.3 * n.hover;
  ctx.strokeStyle = shade(c, 30 + 25 * n.hover);
  ctx.shadowColor = c;
  ctx.shadowBlur = 22 * n.hover;
  ctx.globalAlpha = 0.55 + 0.45 * n.hover;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  /* the name, centered, fading in on hover and shrunk to fit */
  if (n.hover > 0.02){
    const name = (getProject(n.id) || {}).name || '';
    let size = clamp(r * 0.3, 11, 22);
    ctx.font = '600 ' + size + 'px "Space Grotesk", system-ui, sans-serif';
    while (size > 9 && ctx.measureText(name).width > r * 1.6){
      size -= 1;
      ctx.font = '600 ' + size + 'px "Space Grotesk", system-ui, sans-serif';
    }
    let text = name;
    while (text.length > 1 && ctx.measureText(text).width > r * 1.6) text = text.slice(0, -2) + '…';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = n.hover;
    ctx.shadowColor = 'rgba(0,0,0,.55)';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(text, n.x, n.y);
  }
  ctx.restore();
}

function frame(ts){
  raf = null;
  if (!active) return;
  const dt = Math.min(0.033, lastT ? (ts - lastT) / 1000 : 0.016);
  lastT = ts;
  step(dt);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  /* draw the dragged / hovered droplet last, on top */
  [...nodes].sort((a, b) => (a === dragging || a === hovered) - (b === dragging || b === hovered)).forEach(drawDroplet);
  raf = requestAnimationFrame(frame);
}
function start(){ if (!raf){ lastT = 0; raf = requestAnimationFrame(frame); } }
function stop(){ if (raf){ cancelAnimationFrame(raf); raf = null; } }

/* ---- pointer ---- */
function nodeAt(x, y){
  for (let i = nodes.length - 1; i >= 0; i--){
    const n = nodes[i];
    if (Math.hypot(x - n.x, y - n.y) <= n.r) return n;
  }
  return null;
}
function setHovered(n){
  if (n === hovered) return;
  if (hovered) hovered.wob = Math.max(hovered.wob, 0.045);   // leaving: it rings out
  if (n) n.wob = Math.max(n.wob, 0.06);                     // entering: surface-tension wobble
  hovered = n;
  canvas.style.cursor = n ? (dragging ? 'grabbing' : 'pointer') : 'default';
}
const local = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

canvas.addEventListener('pointermove', e => {
  const p = local(e);
  const dx = p.x - pointer.x, dy = p.y - pointer.y;
  pointer = { ...p, inside: true };
  if (press && !dragging && Math.hypot(p.x - press.x, p.y - press.y) > DRAG_START){
    dragging = press.node;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  }
  if (dragging){
    dragging.x = p.x - press.ox; dragging.y = p.y - press.oy;
    dragging.vx = dx * 30; dragging.vy = dy * 30;          // a fling when released
    return;
  }
  setHovered(nodeAt(p.x, p.y));
});
canvas.addEventListener('pointerleave', () => {
  pointer.inside = false;
  if (!dragging) setHovered(null);
});
canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  const p = local(e);
  const n = nodeAt(p.x, p.y);
  if (n) press = { node: n, x: p.x, y: p.y, ox: p.x - n.x, oy: p.y - n.y };
});
canvas.addEventListener('pointerup', e => {
  const wasDrag = !!dragging, n = press && press.node;
  press = null;
  if (dragging){
    dragging = null;
    canvas.releasePointerCapture?.(e.pointerId);
    setHovered(nodeAt(pointer.x, pointer.y));
    return;
  }
  if (!wasDrag && n) activate(n);
});

function activate(n){
  if (n.id === PLUS) openProjectEditor();
  else openProject(n.id);
}

canvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  const p = local(e);
  const n = nodeAt(p.x, p.y);
  if (!n || n.id === PLUS){
    showContextMenu(e.clientX, e.clientY, [{ label: 'New project', action: () => openProjectEditor() }]);
    return;
  }
  const proj = getProject(n.id);
  if (!proj) return;
  showContextMenu(e.clientX, e.clientY, [
    { label: 'Open project', action: () => openProject(proj.id) },
    { label: 'Edit project', action: () => openProjectEditor({ project: getProject(proj.id) }) },
    { label: 'Delete project', danger: true, action: () => { deleteProject(proj.id); toast('Deleted project “' + proj.name + '”'); } }
  ]);
});

/* ---- the project's full-screen page (2c fills it in later) ---- */
function openProject(id){ go({ projectId: id }); }

function renderPage(p){
  page.style.setProperty('--pc', p.color);
  page.querySelector('.pj-page-name').textContent = p.name;
}
/* Esc on the page goes back to the droplets (pop-ups close first: capture runs
   before the history module's own Esc handler) */
window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && active && !page.hidden && !anyPopupOpen()) back();
}, true);

/* ---- called by main.js on every navigation step ---- */
export function applyProjectsState(isActive, projectId, entering){
  active = isActive;
  if (!isActive){ stop(); setHovered(null); press = dragging = null; return; }
  const p = projectId ? getProject(projectId) : null;
  page.hidden = !p;
  if (p){
    renderPage(p);
    stop();
  } else {
    accent = themeColor('--accent-bright') || accent;
    resize();
    sync(entering);
    start();
  }
  if (entering) playEntry(view);
}

new ResizeObserver(() => { if (active && view.clientWidth) resize(); }).observe(view);
onProjectsChange(() => { if (active && page.hidden) sync(false); });
onThemeChange(() => { accent = themeColor('--accent-bright') || accent; if (active) sync(false); });

/* dev server only (stripped from builds): where the droplets are, for browser tests */
if (import.meta.env.DEV) window.__projectsDebug = () => nodes.map(n => ({ id: n.id, x: n.x, y: n.y, r: n.r, hover: n.hover }));
