/* Show a short message at the bottom of the screen */
let toastEl = null, hideTimer = null;

export function toast(msg){
  if (!toastEl){
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    toastEl.setAttribute('role', 'status');
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
}
