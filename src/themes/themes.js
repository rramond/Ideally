/* ============================================================
   THEMES (4) — in carousel order. Each real theme is a full set
   of color tokens (see src/themes/tokens.css for what each one
   is for). Ideally is the original look and the default.
   glow: 'neon' (Ideally), 'soft' (airy shadows) or 'flat'
   (no glow at all, like VS Code); --glow / --glow-bright are the
   colors the neon glows are drawn in, --today-ink is today's
   date (it can't rely on a glow in a flat theme).
   Placeholders ({ placeholder: true }) are "???" cards: they can
   be centered in the carousel, but leave the theme as it is.
============================================================ */
const IDEALLY = {
  '--accent': '#B14CF8', '--accent-dim': '#7C3AED', '--accent-bright': '#C084FC',
  '--accent-pale': '#D8B4FE', '--accent-tint': '#E9D5FF', '--accent-iris': '#A855F7',
  '--ink': '#E9E7F4', '--ink-bright': '#F4ECFF', '--ink-soft': '#C9C6DA', '--muted': '#8B89A0',
  '--dim': '#5E5B7A', '--dim-2': '#4A4963', '--dim-3': '#3C3B52',
  '--bg-deep': '#0A0A10', '--bg': '#0B0B11', '--bg-side': '#0D0D15', '--surface-weekend': '#0F0F17',
  '--surface': '#111119', '--surface2': '#171723', '--hover': '#171622', '--hover2': '#221F33',
  '--line': '#26253A', '--scrollbar': '#2C2B42', '--overlay': '#05050A',
  '--danger': '#FB7185', '--brand-eye': '#0E0617', '--brand-pupil': '#08020E',
  '--glow': '#B14CF8', '--glow-bright': '#C084FC', '--today-ink': '#F4ECFF',
  '--shadow-md': '0 8px 22px rgba(0,0,0,.5)', '--shadow-lg': '0 22px 48px rgba(0,0,0,.65)'
};

/* warm whites, ochre, soft cloud-like shadows; the dim behind pop-ups is a pale veil */
const ETHEREAL_WHITE = {
  '--accent': '#C08A2E', '--accent-dim': '#A0701F', '--accent-bright': '#D4A24C',
  '--accent-pale': '#8A5E16', '--accent-tint': '#F3DDB0', '--accent-iris': '#C9963E',
  '--ink': '#2E2A24', '--ink-bright': '#1F1B16', '--ink-soft': '#5A5247', '--muted': '#8F8473',
  '--dim': '#B3A894', '--dim-2': '#C7BDAB', '--dim-3': '#D5CCBC',
  '--bg-deep': '#EEE8DC', '--bg': '#F7F3EA', '--bg-side': '#FBF8F2', '--surface-weekend': '#F2EDE2',
  '--surface': '#FDFBF6', '--surface2': '#FFFFFF', '--hover': '#F2EBDD', '--hover2': '#EADFCB',
  '--line': '#E3D9C8', '--scrollbar': '#D8CCB6', '--overlay': '#EFE9DD',
  '--danger': '#D9485F', '--brand-eye': '#FFFDF8', '--brand-pupil': '#3A2C1A',
  '--glow': '#E6C58A', '--glow-bright': '#EFD7A6', '--today-ink': '#A0701F',
  '--shadow-md': '0 8px 24px rgba(120,95,55,.13)', '--shadow-lg': '0 22px 50px rgba(120,95,55,.18)'
};

/* VS Code Dark+: neutral greys, blue accent, flat */
const POLARIZED_DARK = {
  '--accent': '#0078D4', '--accent-dim': '#0E639C', '--accent-bright': '#3794FF',
  '--accent-pale': '#75BEFF', '--accent-tint': '#9CDCFE', '--accent-iris': '#569CD6',
  '--ink': '#CCCCCC', '--ink-bright': '#E7E7E7', '--ink-soft': '#B4B4B4', '--muted': '#858585',
  '--dim': '#6A6A6A', '--dim-2': '#5A5A5A', '--dim-3': '#4A4A4A',
  '--bg-deep': '#181818', '--bg': '#1E1E1E', '--bg-side': '#181818', '--surface-weekend': '#1A1A1A',
  '--surface': '#1F1F1F', '--surface2': '#252526', '--hover': '#2A2D2E', '--hover2': '#37373D',
  '--line': '#303030', '--scrollbar': '#424242', '--overlay': '#000000',
  '--danger': '#F14C4C', '--brand-eye': '#1E1E1E', '--brand-pupil': '#0B0B0B',
  '--glow': 'transparent', '--glow-bright': 'transparent', '--today-ink': '#3794FF',
  '--shadow-md': '0 4px 12px rgba(0,0,0,.45)', '--shadow-lg': '0 10px 28px rgba(0,0,0,.55)'
};

export const THEMES = [
  { id: 'ideally', name: 'Ideally', glow: 'neon', tokens: IDEALLY },
  { id: 'ethereal-white', name: 'Ethereal White', glow: 'soft', light: true, tokens: ETHEREAL_WHITE },
  { id: 'polarized-dark', name: 'Polarized Dark', glow: 'flat', tokens: POLARIZED_DARK },
  { id: 'placeholder-1', name: '???', placeholder: true },
  { id: 'placeholder-2', name: '???', placeholder: true }
];
export const DEFAULT_THEME = 'ideally';
export const themeById = id => THEMES.find(t => t.id === id && !t.placeholder) || null;
