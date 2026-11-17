import { themeFx } from "./theme.js";

/* ============================================================
   PETALS (Sakura) — the wave of petals on a tab change. In the
   Sakura theme every view switch sweeps a wide, dense band of
   petals across the screen, from the side panel outwards, like a
   bankai's petal storm. sakura.css draws the band and the petals;
   this lays them out (three drifts, staggered along the wave) and
   clears the overlay after. Any other theme: nothing happens.
============================================================ */
const DENSITY = 0.012; // petals per 1000 px² at a 1000×1000 screen (≈2× a flat scatter)
const MIN = 160,
  MAX = 380; // a screenful, whatever its size
const WAVE_W = 1050; // how deep the band of petals is (px)
const MS = 1900; // a gust travels 1.7s, then the overlay goes
const STAGGER = 190; // so the drifts read as a wave, not three separate gusts
let last = 0,
  timer = null;

const rand = (a, b) => a + Math.random() * (b - a);
const reduceMotion = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches;

export function gust() {
  if (themeFx() !== "sakura") return;
  const now = performance.now();
  if (now - last < 420) return; // a flurry of quick clicks shouldn't stack waves
  last = now;
  if (reduceMotion()) return;

  const vw = innerWidth,
    vh = innerHeight;
  const total = Math.max(
    MIN,
    Math.min(MAX, Math.round(((vw * vh) / 1e6) * 1000 * DENSITY)),
  );

  const layer = document.createElement("div");
  layer.className = "sakura-gust";
  layer.setAttribute("aria-hidden", "true");
  layer.style.setProperty("--w", WAVE_W + "px");

  /* three drifts: the front of the wave (a loose vanguard of a few), the
     main herd (denser toward the front, like a crest), and a tail that
     breaks up behind it — seen from the side panel, left to right */
  const bands = [
    { share: 0.12, x0: 0.5, x1: 0.93, y0: 0.04, y1: 0.96 }, // the vanguard, ahead of the band
    { share: 0.55, x0: 0.03, x1: 0.62, y0: 0.01, y1: 0.99 }, // the crest
    { share: 0.33, x0: 0.0, x1: 0.34, y0: 0.05, y1: 0.95 }, // the trail
  ];

  /* a few big, near petals lead the vanguard and the crest — they sell the
     sense of depth from a distance; the rest are small, so the herd never
     becomes a solid pink curtain over the tab that was just opened */
  const hero = Math.max(10, Math.round(total * 0.09));

  let made = 0;
  bands.forEach((b, k) => {
    const n =
      k === bands.length - 1 ? total - made : Math.round(total * b.share);
    for (let i = 0; i < n; i++) {
      const p = document.createElement("span");
      const big = k < bands.length - 1 && Math.random() < hero / n;
      p.style.setProperty(
        "--x",
        ((b.x0 + Math.random() * (b.x1 - b.x0)) * 100).toFixed(2) + "%",
      );
      p.style.setProperty(
        "--y",
        ((b.y0 + Math.random() * (b.y1 - b.y0)) * 100).toFixed(2) + "%",
      );
      p.style.setProperty(
        "--s",
        (big ? rand(16, 26) : rand(4, 12)).toFixed(1) + "px",
      );
      if (big) p.style.setProperty("--blur", rand(0, 0.8).toFixed(1) + "px");
      p.style.setProperty("--r", rand(-80, 80).toFixed(0) + "deg");
      p.style.setProperty("--up", rand(14, 70).toFixed(0) + "px");
      p.style.setProperty("--drop", rand(30, 120).toFixed(0) + "px");
      p.style.setProperty("--fall", rand(90, 240).toFixed(0) + "px");
      p.style.setProperty("--sway", rand(-34, 34).toFixed(0) + "px");
      p.style.setProperty(
        "--d",
        (big ? rand(1.0, 1.35) : rand(0.85, 1.2)).toFixed(2) + "s",
      );
      /* front petals arrive first, the trail a moment behind */
      p.style.setProperty(
        "--delay",
        (k * STAGGER + rand(0, 260)).toFixed(0) + "ms",
      );
      made++;
      layer.appendChild(p);
    }
  });

  /* four wind streaks riding the crest */
  for (let i = 0; i < 4; i++) {
    const w = document.createElement("i");
    w.style.setProperty("--x", rand(6, 46).toFixed(0) + "%");
    w.style.setProperty("--y", rand(10, 90).toFixed(0) + "%");
    w.style.setProperty("--w", rand(8, 18).toFixed(0) + "vw");
    w.style.setProperty("--d", rand(0.85, 1.25).toFixed(2) + "s");
    w.style.setProperty("--delay", (i * 90 + rand(0, 120)).toFixed(0) + "ms");
    layer.appendChild(w);
  }

  /* keep only the newest wave around: two stacked would double the storm */
  document.querySelectorAll(".sakura-gust").forEach((el) => {
    if (el !== layer) el.remove();
  });
  document.body.appendChild(layer);

  clearTimeout(timer);
  timer = setTimeout(() => layer.remove(), MS);
}

/* every tab change (and coming back to one) brings the wave */
document
  .querySelectorAll(".nav-main .nav-btn")
  .forEach((btn) => btn.addEventListener("click", gust));
window.addEventListener("popstate", gust);
