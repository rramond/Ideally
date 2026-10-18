/* GENERAL b) — every pop-up gets a small, subtle "x" in its top-left
   corner that appears while the cursor is over the pop-up */
export function addCloseX(popEl, onClose){
  popEl.classList.add('has-pop-x');
  const x = document.createElement('button');
  x.type = 'button';
  x.className = 'pop-x';
  x.title = 'Close';
  x.setAttribute('aria-label', 'Close');
  x.textContent = '×';
  x.addEventListener('click', e => { e.stopPropagation(); onClose(); });
  popEl.prepend(x);
  return x;
}
