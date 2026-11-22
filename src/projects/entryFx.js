import { themeColor } from '../themes/theme.js';

/* ============================================================
   PROJECTS ENTRY (2a) — a "cyberpunk corruption" sweep: rows of
   segmented neon bars (EQ display look) in the theme's accent
   shades flow left → right in a swift swipe, each row wiping
   away a cover and leaving the Projects tab behind. Equal
   thickness, random lengths, a few rows glitch on the way.
============================================================ */
const DURATION = 800;   // ms, the whole sweep
const SHADES = ['--accent', '--accent-bright', '--accent-dim', '--accent-pale', '--accent-iris', '--glow-bright'];

export function playEntry(viewEl){
  viewEl.querySelector('.pj-fx')?.remove();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const W = viewEl.clientWidth, H = viewEl.clientHeight;
  if (!W || !H) return;

  const shades = SHADES.map(themeColor).filter(Boolean);
  const fx = document.createElement('div');
  fx.className = 'pj-fx';
  fx.setAttribute('aria-hidden', 'true');
  const rows = Math.max(10, Math.round(H / 34));
  const rowH = H / rows;

  for (let i = 0; i < rows; i++){
    const row = document.createElement('div');
    row.className = 'pj-fx-row';
    row.style.top = (i * rowH) + 'px';
    row.style.height = (Math.ceil(rowH) + 1) + 'px';

    /* slider = [ bar | cover ]: it starts with the bar just off the left edge and the
       cover hiding the row, and ends with both past the right edge */
    const len = W * (0.16 + Math.random() * 0.5);
    const slider = document.createElement('div');
    slider.className = 'pj-fx-slider';
    slider.style.width = (len + W) + 'px';
    const bar = document.createElement('div');
    bar.className = 'pj-fx-bar';
    bar.style.width = len + 'px';
    bar.style.setProperty('--c', shades[Math.floor(Math.random() * shades.length)] || '#B14CF8');
    const cover = document.createElement('div');
    cover.className = 'pj-fx-cover';
    cover.style.left = len + 'px';
    cover.style.width = W + 'px';
    slider.append(bar, cover);
    row.appendChild(slider);
    fx.appendChild(row);

    const delay = Math.random() * 170;
    const dur = DURATION - 240 - delay + Math.random() * 140;
    slider.animate(
      [{ transform: 'translateX(' + (-len) + 'px)' }, { transform: 'translateX(' + W + 'px)' }],
      { duration: dur, delay, easing: 'cubic-bezier(.7,0,.3,1)', fill: 'both' }
    );
    /* glitch: some rows jump sideways and flicker for a moment */
    if (Math.random() < 0.4){
      const j = 6 + Math.random() * 18;
      bar.animate([
        { transform: 'translateX(0)', opacity: 1 },
        { transform: 'translateX(' + j + 'px)', opacity: 0.55 },
        { transform: 'translateX(' + (-j * 0.6) + 'px)', opacity: 1 },
        { transform: 'translateX(0)', opacity: 0.8 }
      ], { duration: 140, iterations: 2, delay: delay + Math.random() * dur * 0.6, easing: 'steps(2, end)' });
    }
  }
  viewEl.appendChild(fx);
  setTimeout(() => fx.remove(), DURATION + 120);
}
