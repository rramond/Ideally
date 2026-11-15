/* sRGB hex → OKLab (Björn Ottosson's matrices). Unlike HSV, straight-line
   distance in OKLab roughly tracks how different two colors look:
   ~0.02 is about where two colors become distinguishable side by side,
   0.08–0.15 reads as "clearly different". */
export function hexToOklab(hex){
  const n = parseInt(hex.replace('#', ''), 16);
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const r = lin(n >> 16), g = lin((n >> 8) & 255), b = lin(n & 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
  ];
}

export const oklabDistance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const colorDistance = (hexA, hexB) => oklabDistance(hexToOklab(hexA), hexToOklab(hexB));
