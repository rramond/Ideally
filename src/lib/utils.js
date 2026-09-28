export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
export const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

/* lighten (amt > 0) or darken (amt < 0) a #RRGGBB color by amt percent */
export function shade(hex, amt){
  const n = parseInt(hex.slice(1), 16);
  const f = c => Math.min(255, Math.max(0, c + Math.round(255 * amt / 100)));
  return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')';
}
