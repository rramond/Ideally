/* ============================================================
   REMINDER PICTOGRAMS — the emoji grid of the pictogram chooser
   and the default one: a cartoony red double exclamation mark,
   the right mark set a little higher than the left.
============================================================ */
export const PICTOGRAMS = [
  '🎂', '🎉', '🎁', '🎈', '🥂', '🍰', '💍', '❤️',
  '💐', '🌹', '🌸', '👶', '🎓', '🏆', '⭐', '✨',
  '📌', '⏰', '📅', '📝', '📚', '💼', '💸', '🧾',
  '📦', '✈️', '🏠', '🚗', '🦷', '💊', '🏥', '🐾',
  '🎄', '🎃', '🎵', '🎮', '⚽', '🌙', '🔔', '⚠️'
];

/* one mark: a tapered bar with a dot below it; a white shine on the bar */
const mark = (x, y, tilt) =>
  '<g transform="translate(' + x + ' ' + y + ') rotate(' + tilt + ' 3.5 10)">' +
    '<path d="M0.6 2.6 Q0.6 0 3.5 0 Q6.4 0 6.4 2.6 L5.3 13.4 Q5.1 15 3.5 15 Q1.9 15 1.7 13.4 Z"/>' +
    '<circle cx="3.5" cy="19.4" r="2.6"/>' +
    '<path class="pg-shine" d="M2.2 2.4 Q2.3 1.3 3.3 1.2" fill="none"/>' +
  '</g>';

export const DEFAULT_PICTOGRAM_SVG =
  '<svg class="pg-default" viewBox="0 0 24 25" aria-hidden="true">' +
    '<g fill="#ff3d55" stroke="#6e0b1a" stroke-width="1.3" stroke-linejoin="round">' +
      mark(3, 3.2, -7) + mark(13.4, 0.8, 6) +
    '</g>' +
  '</svg>';

/* the pictogram of a reminder, as a node (a span holding the emoji or the default svg) */
export function pictogramNode(icon, cls = 'pg'){
  const span = document.createElement('span');
  span.className = cls;
  if (icon) span.textContent = icon;
  else { span.classList.add('pg-is-default'); span.innerHTML = DEFAULT_PICTOGRAM_SVG; }
  return span;
}
