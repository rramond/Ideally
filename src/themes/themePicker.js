import { openPopup, closePopup, isPopupOpen } from '../lib/history.js';
import { addCloseX } from '../lib/popups.js';
import { getThemes, getTheme, setTheme } from './theme.js';

/* ============================================================
   THEMES DROPDOWN (4) — the Themes button at the bottom of the
   main side panel drops a panel from the top of the screen:
   the themes in a looping horizontal carousel of screen-shaped
   previews, the current one centered and bigger, its name above
   as ‹ NAME ›. The arrows, the mouse wheel (up = right
   neighbour, down = left), ← / → and clicking a side card move
   it; the centered theme is applied right away ("???"
   placeholders leave the theme as it is). Clicking outside, the
   × (or Esc / Back) closes it.
============================================================ */
const PICKER = 'theme-picker';
const CENTER_W = 330, SIDE = 0.6, FAR = 0.42, GAP = 22;   // card widths: center, ×SIDE beside it, ×FAR at the edges
const WHEEL_STEP = 40;                                     // wheel distance (px) per step, as in the calendar

const el = (tag, cls, text) => {
  const x = document.createElement(tag);
  if (cls) x.className = cls;
  if (text != null) x.textContent = text;
  return x;
};

/* a small drawn copy of the app (sidebar, calendar bar, a week with a few
   events) in the theme's own colors — the tokens are set on the card itself */
const MOCK_EVENTS = [            // [column, top %, height %, color]
  [0, 18, 18, '#5BC8FF'], [1, 44, 14, '#71E69A'], [2, 24, 22, '#C084FC'], [3, 56, 12, '#FF6FA5'],
  [4, 14, 10, '#5BC8FF'], [4, 62, 16, '#C084FC'], [6, 38, 14, '#FF6FA5']
];
function mockup(theme){
  const m = el('div', 'tpk-mock');
  Object.entries(theme.tokens).forEach(([k, v]) => m.style.setProperty(k, v));
  m.dataset.glow = theme.glow;
  const side = el('div', 'm-side');
  side.append(el('i', 'm-logo'), el('i', 'm-nav'), el('i', 'm-nav on'), el('i', 'm-nav'), el('i', 'm-nav'));
  const main = el('div', 'm-main');
  const bar = el('div', 'm-bar');
  bar.append(el('i', 'm-title'), el('i', 'm-btn'));
  const week = el('div', 'm-week');
  for (let c = 0; c < 7; c++){
    const col = el('div', 'm-col' + (c === 2 ? ' today' : '') + (c >= 5 ? ' weekend' : ''));
    col.appendChild(el('i', 'm-head'));
    MOCK_EVENTS.filter(e => e[0] === c).forEach(([, top, h, color]) => {
      const ev = el('i', 'm-ev');
      ev.style.top = top + '%';
      ev.style.height = h + '%';
      ev.style.setProperty('--tc', color);
      col.appendChild(ev);
    });
    week.appendChild(col);
  }
  main.append(bar, week);
  m.append(side, main);
  return m;
}
function placeholderCard(){
  const m = el('div', 'tpk-mock tpk-unknown');
  m.appendChild(el('span', 'tpk-q', '?'));
  return m;
}

export function openThemePicker(){
  if (isPopupOpen(PICKER)){ closePopup(PICKER); return; }
  const themes = getThemes(), n = themes.length;
  let cur = Math.max(0, themes.indexOf(getTheme()));

  const overlay = el('div', 'tpk-overlay');
  const panel = el('div', 'tpk-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Themes');
  const head = el('div', 'tpk-head');
  const prev = el('button', 'icon-btn tpk-arrow', '‹');
  const next = el('button', 'icon-btn tpk-arrow', '›');
  prev.type = next.type = 'button';
  prev.title = 'Previous theme'; next.title = 'Next theme';
  const nameEl = el('span', 'tpk-name');
  nameEl.setAttribute('aria-live', 'polite');
  head.append(prev, nameEl, next);
  const track = el('div', 'tpk-track');
  track.style.setProperty('--ar', (innerWidth / innerHeight).toFixed(3));   // the screen's proportions
  const cards = themes.map((t, i) => {
    const card = el('button', 'tpk-card');
    card.type = 'button';
    card.setAttribute('aria-label', t.name);
    card.appendChild(t.placeholder ? placeholderCard() : mockup(t));
    card.addEventListener('click', () => go(i - cur));
    track.appendChild(card);
    return card;
  });
  panel.append(head, track);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  const close = () => closePopup(PICKER);
  const onKey = e => {
    if (e.key === 'ArrowLeft'){ e.preventDefault(); go(-1); }
    else if (e.key === 'ArrowRight'){ e.preventDefault(); go(1); }
  };
  openPopup(PICKER, () => { overlay.remove(); document.removeEventListener('keydown', onKey); });
  addCloseX(panel, close);
  overlay.addEventListener('pointerdown', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);
  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));

  /* wheel: up → right neighbour, down → left neighbour (one step per notch) */
  let wheelAcc = 0, wheelIdle = null;
  panel.addEventListener('wheel', e => {
    e.preventDefault();
    wheelAcc += e.deltaY * (e.deltaMode === 1 ? 16 : 1);
    clearTimeout(wheelIdle);
    wheelIdle = setTimeout(() => { wheelAcc = 0; }, 200);
    if (Math.abs(wheelAcc) < WHEEL_STEP) return;
    const dir = wheelAcc < 0 ? 1 : -1;
    wheelAcc = 0;
    go(dir);
  }, { passive: false });

  /* x of each card's center for an offset d from the center (looping, |d| ≤ n/2) */
  const sideW = CENTER_W * SIDE, farW = CENTER_W * FAR;
  const xAt = d => {
    const a = Math.abs(d);
    const x = a === 0 ? 0 : a === 1 ? CENTER_W / 2 + GAP + sideW / 2
      : CENTER_W / 2 + GAP + sideW + GAP + farW / 2 + (a - 2) * (farW + GAP);
    return Math.sign(d) * x;
  };
  const offsetOf = i => { let d = ((i - cur) % n + n) % n; if (d > n / 2) d -= n; return d; };
  const last = new Map();
  function layout(){
    cards.forEach((card, i) => {
      const d = offsetOf(i), a = Math.abs(d);
      /* a card wrapping from one end to the other jumps instead of sliding across */
      const prevD = last.get(card);
      card.classList.toggle('no-anim', prevD != null && Math.abs(prevD - d) > 1);
      last.set(card, d);
      const scale = a === 0 ? 1 : a === 1 ? SIDE : FAR;
      card.style.transform = 'translateX(calc(-50% + ' + xAt(d) + 'px)) scale(' + scale + ')';
      card.style.zIndex = 10 - a;
      card.style.opacity = a === 0 ? 1 : a === 1 ? 0.85 : 0.5;
      card.classList.toggle('center', a === 0);
      card.tabIndex = a === 0 ? 0 : -1;
    });
    nameEl.textContent = themes[cur].name;
  }
  function go(step){
    if (!step) return;
    cur = ((cur + step) % n + n) % n;
    layout();
    const t = themes[cur];
    if (!t.placeholder) setTheme(t.id);        // the centered theme is applied right away
  }
  track.style.setProperty('--cw', CENTER_W + 'px');
  layout();
}

document.getElementById('theme-btn').addEventListener('click', openThemePicker);
