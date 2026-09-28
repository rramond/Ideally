import { clamp, shade } from '../lib/utils.js';

/* ============================================================
   Scenes (canvas) behind the focus timer
============================================================ */
const timerView = document.getElementById('view-timer');
const sceneSel = document.getElementById('scene-sel');
const canvas = document.getElementById('scene-canvas');
const cx2d = canvas.getContext('2d');
let sceneLoopId = null;
let stars = [], fireflies = [];

export function resizeSceneCanvas(){
  canvas.width = timerView.clientWidth;
  canvas.height = timerView.clientHeight;
  stars = []; fireflies = [];
}
window.addEventListener('resize', () => {
  if (timerView.classList.contains('active')) resizeSceneCanvas();
});

function ensureStars(w, h, n){
  if (stars.length) return;
  for (let i = 0; i < n; i++)
    stars.push({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.3 + 0.3, tw: Math.random() * 2 + 0.5, ph: Math.random() * 6.28 });
}
function drawStars(w, h, t, dimBelow){
  ensureStars(w, h, 160);
  stars.forEach(st => {
    if (dimBelow && st.y > dimBelow) return;
    const a = 0.35 + 0.5 * (0.5 + 0.5 * Math.sin(t * st.tw + st.ph));
    cx2d.fillStyle = 'rgba(225,225,255,' + a + ')';
    cx2d.beginPath(); cx2d.arc(st.x, st.y, st.r, 0, 6.28); cx2d.fill();
  });
}

function drawJungle(w, h, t){
  const g = cx2d.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#03110A'); g.addColorStop(0.6, '#041A0F'); g.addColorStop(1, '#020A06');
  cx2d.fillStyle = g; cx2d.fillRect(0, 0, w, h);

  const mg = cx2d.createRadialGradient(w * 0.82, h * 0.14, 10, w * 0.82, h * 0.14, 180);
  mg.addColorStop(0, 'rgba(210,235,215,.30)'); mg.addColorStop(1, 'transparent');
  cx2d.fillStyle = mg; cx2d.fillRect(0, 0, w, h);

  const layers = [
    { c: '#06301C', yb: 0.78, amp: 60, n: 7, sw: 4 },
    { c: '#04220F', yb: 0.88, amp: 80, n: 6, sw: 7 },
    { c: '#02130A', yb: 0.98, amp: 95, n: 5, sw: 10 }
  ];
  layers.forEach((L, li) => {
    cx2d.fillStyle = L.c;
    for (let i = 0; i <= L.n; i++){
      const bx = (i / L.n) * w + Math.sin(t * 0.18 + li * 2 + i) * 6;
      const by = h * L.yb;
      const r = L.amp + Math.sin(i * 3.7 + li) * 22;
      cx2d.beginPath();
      cx2d.ellipse(bx, by + 30, r * 1.5, r, Math.sin(i + li) * 0.3, 0, 6.28);
      cx2d.fill();
    }
    for (let i = 0; i < L.sw; i++){
      const vx = ((i * 1.7 + li) % L.sw) / L.sw * w;
      const sway = Math.sin(t * 0.3 + i + li) * 14;
      cx2d.strokeStyle = L.c; cx2d.lineWidth = 3;
      cx2d.beginPath();
      cx2d.moveTo(vx, 0);
      cx2d.quadraticCurveTo(vx + sway, h * 0.15, vx + sway * 1.6, h * (0.24 + (i % 3) * 0.05));
      cx2d.stroke();
    }
  });

  if (!fireflies.length)
    for (let i = 0; i < 26; i++)
      fireflies.push({ x: Math.random() * w, y: h * (0.3 + Math.random() * 0.55), vx: 0, vy: 0, ph: Math.random() * 6.28 });
  fireflies.forEach(f => {
    f.vx += (Math.random() - 0.5) * 0.05; f.vy += (Math.random() - 0.5) * 0.05;
    f.vx = clamp(f.vx, -0.4, 0.4); f.vy = clamp(f.vy, -0.3, 0.3);
    f.x = (f.x + f.vx + w) % w; f.y = clamp(f.y + f.vy, h * 0.2, h * 0.92);
    const a = 0.25 + 0.75 * Math.max(0, Math.sin(t * 1.4 + f.ph));
    const fg = cx2d.createRadialGradient(f.x, f.y, 0, f.x, f.y, 9);
    fg.addColorStop(0, 'rgba(190,255,140,' + a + ')'); fg.addColorStop(1, 'transparent');
    cx2d.fillStyle = fg;
    cx2d.beginPath(); cx2d.arc(f.x, f.y, 9, 0, 6.28); cx2d.fill();
  });
}

function drawSpace(w, h, t){
  cx2d.fillStyle = '#020409'; cx2d.fillRect(0, 0, w, h);
  drawStars(w, h, t);
  const cx = w * 0.5, cy = h * 0.44, sc = Math.min(w, h) / 600;

  const planets = [
    { a: 150 * sc, b: 50 * sc, r: 9 * sc,  c: '#7DD3FC', sp: 0.5,  off: 0 },
    { a: 240 * sc, b: 82 * sc, r: 15 * sc, c: '#F0ABFC', sp: 0.26, off: 2.2 },
    { a: 330 * sc, b: 112 * sc, r: 7 * sc, c: '#FDE68A', sp: 0.15, off: 4.4 }
  ].map(p => {
    const ang = t * p.sp + p.off;
    return { ...p, px: cx + Math.cos(ang) * p.a, py: cy + Math.sin(ang) * p.b, behind: Math.sin(ang) < 0 };
  });

  cx2d.strokeStyle = 'rgba(170,160,220,.14)'; cx2d.lineWidth = 1;
  planets.forEach(p => {
    cx2d.beginPath(); cx2d.ellipse(cx, cy, p.a, p.b, 0, 0, 6.28); cx2d.stroke();
  });

  const drawPlanet = p => {
    const pg = cx2d.createRadialGradient(p.px - p.r * 0.4, p.py - p.r * 0.4, p.r * 0.1, p.px, p.py, p.r);
    pg.addColorStop(0, '#FFFFFF'); pg.addColorStop(0.35, p.c); pg.addColorStop(1, shade(p.c, -55));
    cx2d.fillStyle = pg;
    cx2d.beginPath(); cx2d.arc(p.px, p.py, p.r, 0, 6.28); cx2d.fill();
  };
  planets.filter(p => p.behind).forEach(drawPlanet);

  const sr = (34 + Math.sin(t * 1.8) * 3) * sc;
  const sg = cx2d.createRadialGradient(cx, cy, 0, cx, cy, sr * 4);
  sg.addColorStop(0, 'rgba(255,255,240,1)');
  sg.addColorStop(0.12, 'rgba(255,240,200,.95)');
  sg.addColorStop(0.3, 'rgba(255,200,130,.35)');
  sg.addColorStop(1, 'transparent');
  cx2d.fillStyle = sg;
  cx2d.beginPath(); cx2d.arc(cx, cy, sr * 4, 0, 6.28); cx2d.fill();

  planets.filter(p => !p.behind).forEach(drawPlanet);
}

function drawBlackHole(w, h, t){
  cx2d.fillStyle = '#030308'; cx2d.fillRect(0, 0, w, h);
  drawStars(w, h, t);
  const cx = w * 0.5, cy = h * 0.46, R = Math.min(w, h) * 0.21;
  const rx = R * 1.9, ry = R * 0.5, rot = t * 1.1, N = 130;

  const seg = (from, to) => {
    for (let i = 0; i < N; i++){
      const a = (i / N) * 6.283;
      const sn = Math.sin(a);
      if (sn < from || sn >= to) continue;
      const ex = cx + Math.cos(a) * rx;
      const ey = cy + sn * ry;
      const doppler = 0.5 - 0.5 * Math.cos(a + rot);         // bright side sweeps
      const heat = 0.35 + 0.65 * doppler;
      const rr = 2 + 2.6 * heat;
      cx2d.shadowBlur = 14 * heat;
      cx2d.shadowColor = 'rgba(255,170,80,' + (0.5 * heat) + ')';
      cx2d.fillStyle = 'rgba(' + Math.round(255) + ',' + Math.round(150 + 100 * heat) + ',' + Math.round(70 + 150 * heat) + ',' + (0.25 + 0.7 * heat) + ')';
      cx2d.beginPath(); cx2d.arc(ex, ey, rr, 0, 6.28); cx2d.fill();
    }
    cx2d.shadowBlur = 0;
  };

  seg(-1.1, 0);                                  // back half of the disk

  cx2d.beginPath(); cx2d.arc(cx, cy, R * 0.78, 0, 6.28);   // event horizon
  cx2d.fillStyle = '#000'; cx2d.fill();
  cx2d.strokeStyle = 'rgba(255,200,130,.9)';     // photon ring
  cx2d.lineWidth = 1.6;
  cx2d.shadowBlur = 16; cx2d.shadowColor = 'rgba(255,180,90,.8)';
  cx2d.beginPath(); cx2d.arc(cx, cy, R * 0.82, 0, 6.28); cx2d.stroke();
  cx2d.shadowBlur = 0;

  cx2d.strokeStyle = 'rgba(255,170,90,.35)';     // lensed halo above
  cx2d.lineWidth = 5;
  cx2d.beginPath(); cx2d.ellipse(cx, cy - R * 0.42, R * 0.95, R * 0.42, 0, Math.PI, 6.283); cx2d.stroke();

  seg(0, 1.1);                                   // front half of the disk
}

function drawOcean(w, h, t){
  const hor = h * 0.55;
  const sky = cx2d.createLinearGradient(0, 0, 0, hor);
  sky.addColorStop(0, '#190F3C'); sky.addColorStop(0.45, '#54265F');
  sky.addColorStop(0.8, '#C3503F'); sky.addColorStop(1, '#FF9B4E');
  cx2d.fillStyle = sky; cx2d.fillRect(0, 0, w, hor + 2);

  const sx = w * 0.5, sr = Math.min(w, h) * 0.1;
  const glow = cx2d.createRadialGradient(sx, hor, 0, sx, hor, sr * 3.4);
  glow.addColorStop(0, 'rgba(255,210,140,.9)'); glow.addColorStop(1, 'transparent');
  cx2d.fillStyle = glow;
  cx2d.beginPath(); cx2d.arc(sx, hor, sr * 3.4, 0, 6.28); cx2d.fill();
  cx2d.fillStyle = '#FFD9A0';                                   // sun, half set
  cx2d.beginPath(); cx2d.arc(sx, hor, sr, Math.PI, 6.283); cx2d.fill();

  const sea = cx2d.createLinearGradient(0, hor, 0, h);
  sea.addColorStop(0, '#3A1A55'); sea.addColorStop(0.4, '#1C1140'); sea.addColorStop(1, '#0A0822');
  cx2d.fillStyle = sea; cx2d.fillRect(0, hor, w, h - hor);

  for (let i = 0; i < 9; i++){                                  // rocking wave bands
    const baseY = hor + 12 + i * ((h - hor - 20) / 9);
    const amp = 2 + i * 0.7;
    const speed = 0.9 + i * 0.12;
    cx2d.strokeStyle = i % 2
      ? 'rgba(255,150,90,' + (0.26 - i * 0.022) + ')'
      : 'rgba(190,120,255,' + (0.20 - i * 0.016) + ')';
    cx2d.lineWidth = 1.4;
    cx2d.beginPath();
    for (let x = 0; x <= w; x += 14){
      const y = baseY + Math.sin(x * 0.02 + t * speed + i * 1.3) * amp
                      + Math.sin(t * 0.5 + i) * 3;             // slow rocking
      x === 0 ? cx2d.moveTo(x, y) : cx2d.lineTo(x, y);
    }
    cx2d.stroke();
  }

  for (let k = 0; k < 42; k++){                                  // sun shimmer on water
    const y = hor + 8 + Math.random() * (h - hor - 30);
    const spread = 24 + (y - hor) * 0.55;
    const x = sx + (Math.random() - 0.5) * spread;
    const len = 6 + Math.random() * 22;
    cx2d.strokeStyle = 'rgba(255,190,120,' + (0.05 + Math.random() * 0.3) + ')';
    cx2d.lineWidth = 1.6;
    cx2d.beginPath(); cx2d.moveTo(x - len / 2, y); cx2d.lineTo(x + len / 2, y); cx2d.stroke();
  }
}

const SCENE_DRAW = { jungle: drawJungle, space: drawSpace, blackhole: drawBlackHole, ocean: drawOcean };
let lastScene = null;
function sceneLoop(ts){
  if (!timerView.classList.contains('active')){ sceneLoopId = null; return; }
  const t = ts / 1000;
  const scene = sceneSel.value;
  if (scene !== lastScene){ stars = []; fireflies = []; lastScene = scene; }
  if (canvas.width !== timerView.clientWidth || canvas.height !== timerView.clientHeight) resizeSceneCanvas();
  (SCENE_DRAW[scene] || drawJungle)(canvas.width, canvas.height, t);
  sceneLoopId = requestAnimationFrame(sceneLoop);
}
export function ensureSceneLoop(){
  if (!sceneLoopId) sceneLoopId = requestAnimationFrame(sceneLoop);
}
