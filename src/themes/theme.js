import { store } from '../lib/storage.js';
import { THEMES, DEFAULT_THEME, themeById } from './themes.js';

/* ============================================================
   THEME (4) — which theme is on, applying it (its tokens are set
   on <html>, overriding src/themes/tokens.css), remembering it,
   a short crossfade when it changes, and the favicon.
   A theme may also bring an effect (fx: 'sakura'), named on <html>
   as data-fx — src/themes/sakura.css draws it.
============================================================ */
const root = document.documentElement;
const saved = store.get('ideally.theme', DEFAULT_THEME);
let current = themeById(typeof saved === 'string' ? saved : '') || themeById(DEFAULT_THEME);
const listeners = [];
export const onThemeChange = fn => listeners.push(fn);

/* the current value of a token ('--accent-bright' → '#C084FC'), for JS defaults */
export const themeColor = name => getComputedStyle(root).getPropertyValue(name).trim();
export const getTheme = () => current;
export const themeFx = () => current.fx || null;
export const getThemes = () => THEMES;

let fadeTimer = null;
function apply(animate){
  if (animate){
    root.classList.add('theming');                 // theme.css: colors ease over while this is on
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => root.classList.remove('theming'), 500);
  }
  Object.entries(current.tokens).forEach(([k, v]) => root.style.setProperty(k, v));
  root.dataset.theme = current.id;
  root.dataset.glow = current.glow;
  if (current.fx) root.dataset.fx = current.fx; else delete root.dataset.fx;
  root.style.colorScheme = current.light ? 'light' : 'dark';
  setFavicon(current.tokens);
  listeners.forEach(fn => fn(current));
}

/* switch to a real theme (placeholders are ignored) */
export function setTheme(id){
  const t = themeById(id);
  if (!t || t === current) return;
  current = t;
  store.set('ideally.theme', t.id);
  apply(true);
}

/* the tab icon is the logo, in the theme's colors (a data URI can't read CSS) */
function setFavicon(t){
  const link = document.querySelector('link[rel="icon"]');
  if (!link) return;
  const svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>" +
    "<path d='M4 32 Q32 8 60 32 Q32 56 4 32Z' fill='" + t['--brand-eye'] + "' stroke='" + t['--accent-bright'] + "' stroke-width='3'/>" +
    "<circle cx='32' cy='32' r='12' fill='" + t['--accent-iris'] + "'/>" +
    "<circle cx='32' cy='32' r='5' fill='" + t['--brand-pupil'] + "'/>" +
    "<circle cx='28' cy='28' r='2.5' fill='white'/></svg>";
  link.href = 'data:image/svg+xml,' + encodeURIComponent(svg).replace(/'/g, '%27');
}

apply(false);
