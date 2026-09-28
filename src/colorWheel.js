/* ============================================================
   Color wheel popover — hue around the wheel, saturation toward
   the center, a brightness slider and a hex field
============================================================ */
export function hsvToHex(h, s, v){
  const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return '#' + [f(5), f(3), f(1)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function hexToHsv(hex){
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  let h = 0;
  if (d){
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

/* Clicking `trigger` toggles the popover, starting from getColor();
   onChange(hex) fires live while picking. */
export function attachColorWheel(trigger, getColor, onChange){
  let hsv = hexToHsv(getColor());

  const pop = document.createElement('div');
  pop.className = 'cw-pop';
  pop.hidden = true;
  pop.innerHTML =
    '<div class="cw-wheel"><div class="cw-shade"></div><div class="cw-dot"></div></div>' +
    '<div class="cw-value" role="slider" tabindex="0" aria-label="Brightness" aria-valuemin="0" aria-valuemax="100">' +
      '<div class="cw-thumb"></div></div>' +
    '<div class="cw-row"><span class="cw-preview"></span>' +
    '<input class="cw-hex" maxlength="7" spellcheck="false" autocomplete="off" aria-label="Hex color"></div>';
  trigger.after(pop);

  const wheel = pop.querySelector('.cw-wheel');
  const shadeEl = pop.querySelector('.cw-shade');
  const dot = pop.querySelector('.cw-dot');
  const valueIn = pop.querySelector('.cw-value');
  const thumb = pop.querySelector('.cw-thumb');
  const preview = pop.querySelector('.cw-preview');
  const hexIn = pop.querySelector('.cw-hex');

  /* don't take focus away from text being edited (except to type a hex) */
  pop.addEventListener('mousedown', e => { if (e.target !== hexIn) e.preventDefault(); });

  function render(){
    const hex = hsvToHex(hsv.h, hsv.s, hsv.v);
    const a = hsv.h * Math.PI / 180;
    dot.style.left = (50 + Math.sin(a) * hsv.s * 50) + '%';
    dot.style.top  = (50 - Math.cos(a) * hsv.s * 50) + '%';
    dot.style.background = hex;
    shadeEl.style.opacity = 1 - hsv.v;
    thumb.style.left = (hsv.v * 100) + '%';
    valueIn.setAttribute('aria-valuenow', Math.round(hsv.v * 100));
    valueIn.style.background = 'linear-gradient(to right, #000, ' + hsvToHex(hsv.h, hsv.s, 1) + ')';
    preview.style.background = hex;
    if (document.activeElement !== hexIn) hexIn.value = hex;
  }
  const emit = () => onChange(hsvToHex(hsv.h, hsv.s, hsv.v));

  /* hue = angle clockwise from the top (red), saturation = distance from center */
  let picking = false;
  function pick(e){
    const r = wheel.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    hsv.h = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
    hsv.s = Math.min(1, Math.hypot(dx, dy) / (r.width / 2));
    render(); emit();
  }
  wheel.addEventListener('pointerdown', e => {
    picking = true;
    wheel.setPointerCapture(e.pointerId);
    pick(e);
  });
  wheel.addEventListener('pointermove', e => { if (picking) pick(e); });
  wheel.addEventListener('pointerup', e => {
    picking = false;
    wheel.releasePointerCapture(e.pointerId);
  });

  let sliding = false;
  function slide(e){
    const r = valueIn.getBoundingClientRect();
    hsv.v = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    render(); emit();
  }
  valueIn.addEventListener('pointerdown', e => {
    sliding = true;
    valueIn.setPointerCapture(e.pointerId);
    slide(e);
  });
  valueIn.addEventListener('pointermove', e => { if (sliding) slide(e); });
  valueIn.addEventListener('pointerup', e => {
    sliding = false;
    valueIn.releasePointerCapture(e.pointerId);
  });
  valueIn.addEventListener('keydown', e => {
    const d = { ArrowLeft: -0.05, ArrowDown: -0.05, ArrowRight: 0.05, ArrowUp: 0.05 }[e.key];
    if (!d) return;
    e.preventDefault();
    hsv.v = Math.min(1, Math.max(0, hsv.v + d));
    render(); emit();
  });
  hexIn.addEventListener('input', () => {
    const v = hexIn.value.trim();
    if (!/^#?[0-9a-f]{6}$/i.test(v)) return;
    hsv = hexToHsv(v);
    render(); emit();
  });
  hexIn.addEventListener('blur', render);

  const close = () => { pop.hidden = true; };
  trigger.addEventListener('click', () => {
    pop.hidden = !pop.hidden;
    if (!pop.hidden){ hsv = hexToHsv(getColor()); render(); }
  });
  document.addEventListener('pointerdown', e => {
    if (!pop.hidden && !pop.contains(e.target) && !trigger.contains(e.target)) close();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  render();
}
