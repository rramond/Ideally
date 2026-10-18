import { openPopup, closePopup } from './history.js';
import { addCloseX } from './popups.js';

/* Small right-click menu. items: [{ label, action, danger? }] */
const MENU = 'context-menu';

export function showContextMenu(x, y, items){
  closePopup(MENU);
  const menu = document.createElement('div');
  menu.className = 'ctx-menu';
  menu.setAttribute('role', 'menu');
  items.forEach(it => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ctx-item' + (it.danger ? ' danger' : '');
    b.setAttribute('role', 'menuitem');
    b.textContent = it.label;
    b.addEventListener('click', () => { closePopup(MENU); it.action(); });
    menu.appendChild(b);
  });
  document.body.appendChild(menu);

  /* keep it on screen */
  const r = menu.getBoundingClientRect();
  menu.style.left = Math.min(x, innerWidth - r.width - 8) + 'px';
  menu.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';

  const onDown = e => {
    if (!menu.contains(e.target) && !e.target.closest('[data-back]')) closePopup(MENU);
  };
  openPopup(MENU, () => {
    menu.remove();
    document.removeEventListener('pointerdown', onDown, true);
  });
  document.addEventListener('pointerdown', onDown, true);
  addCloseX(menu, () => closePopup(MENU));
  menu.querySelector('.ctx-item')?.focus();
}
