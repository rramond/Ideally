import { hsvToHex } from '../colorWheel.js';
import { colorDistance } from './oklab.js';
import { themeColor } from '../themes/theme.js';

/* a vivid color as far as possible (in OKLab) from every color in `used` —
   what a new period, or a first override color, is offered */
export function farthestColor(used, fallback = themeColor('--accent-bright')){
  if (!used.length) return fallback;
  let best = fallback, bestD = -1;
  for (let h = 0; h < 360; h += 6){
    for (const [s, v] of [[0.6, 0.98], [0.45, 0.85], [0.75, 0.75]]){
      const hex = hsvToHex(h, s, v);
      const d = Math.min(...used.map(u => colorDistance(hex, u)));
      if (d > bestD){ best = hex; bestD = d; }
    }
  }
  return best;
}
