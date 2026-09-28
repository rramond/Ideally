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

/* ============================================================
   View switching
============================================================ */
const views = document.querySelectorAll('.view');
const navBtns = document.querySelectorAll('.nav-btn');
navBtns.forEach(btn => btn.addEventListener('click', () => {
  navBtns.forEach(b => b.classList.toggle('active', b === btn));
  views.forEach(v => v.classList.toggle('active', v.id === 'view-' + btn.dataset.view));
  if (btn.dataset.view === 'board'){ renderArrows(); renderHandles(); }
  if (btn.dataset.view === 'timer'){ resizeSceneCanvas(); ensureSceneLoop(); }
}));
