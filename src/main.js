import './styles/base.css';
import './styles/components.css';
import './styles/notes.css';
import './styles/calendar.css';
import './styles/board.css';
import './styles/color-wheel.css';
import './styles/timer.css';

import './notes.js';
import './calendar.js';
import { renderArrows, renderHandles } from './board.js';
import './timer/timer.js';
import { resizeSceneCanvas, ensureSceneLoop } from './timer/scenes.js';
import { toast } from './lib/toast.js';

/* ============================================================
   View switching
============================================================ */
const sidebar = document.querySelector('.sidebar');
const views = document.querySelectorAll('.view');
const navBtns = document.querySelectorAll('.nav-main .nav-btn');

/* the calendar replaces the main menu with its own side panel */
function setCalMode(on){ sidebar.classList.toggle('cal-mode', on); }

function showView(name){
  navBtns.forEach(b => b.classList.toggle('active', b.dataset.view === name));
  views.forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  if (name === 'board'){ renderArrows(); renderHandles(); }
  if (name === 'timer'){ resizeSceneCanvas(); ensureSceneLoop(); }
  setCalMode(name === 'calendar');
}
navBtns.forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));

/* logo: back to the main menu, leaving the calendar open for viewing;
   clicking the calendar itself brings its side panel back */
document.getElementById('brand').addEventListener('click', () => {
  if (sidebar.classList.contains('cal-mode')) setCalMode(false);
});
document.getElementById('view-calendar').addEventListener('click', () => setCalMode(true));

document.querySelectorAll('.nav-cal [data-soon]').forEach(btn =>
  btn.addEventListener('click', () => toast(btn.dataset.soon + ' — coming soon')));
