/* ============================================================
   THEME — the current value of a token, for the few places in
   JS that need a theme color (defaults offered to the user).
============================================================ */
export const themeColor = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
