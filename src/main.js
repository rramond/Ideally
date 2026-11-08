import './styles/base.css';
import './styles/components.css';
import './styles/notes.css';
import './styles/calendar.css';
import './styles/board.css';
import './styles/color-wheel.css';
import './styles/event-editor.css';
import './styles/timer.css';

import './notes.js';
import './calendar/calendar.js';
import { openEventEditor } from './calendar/eventEditor.js';
import './calendar/timeBlocks.js';
import { renderArrows, renderHandles } from './board.js';
import './timer/timer.js';
import { resizeSceneCanvas, ensureSceneLoop } from './timer/scenes.js';
import { toast } from './lib/toast.js';
import { initHistory, go, back, getState } from './lib/history.js';
import { isoDate, fromHours } from './lib/dates.js';

/* ============================================================
   View switching
============================================================ */
const sidebar = document.querySelector('.sidebar');
const views = document.querySelectorAll('.view');
const navBtns = document.querySelectorAll('.nav-main .nav-btn');

function applyState({ view, calMode, blocks }){
  navBtns.forEach(b => b.classList.toggle('active', b.dataset.view === view));
  views.forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  if (view === 'board'){ renderArrows(); renderHandles(); }
  if (view === 'timer'){ resizeSceneCanvas(); ensureSceneLoop(); }
  /* the calendar replaces the main menu with its own side panel */
  sidebar.classList.toggle('cal-mode', view === 'calendar' && !!calMode);
  sidebar.classList.toggle('blocks-mode', view === 'calendar' && !!calMode && !!blocks);
}
initHistory({ view: 'notes', calMode: false, blocks: false }, applyState);

navBtns.forEach(btn => btn.addEventListener('click', () => {
  const { view } = getState();
  const target = btn.dataset.view;
  if (target === 'calendar'){
    /* two steps, so Back first leaves the side panel (calendar still in view),
       then returns to the previous tab */
    if (view !== 'calendar') go({ view: 'calendar', calMode: false, blocks: false });
    if (!getState().calMode) go({ calMode: true, blocks: false });
  } else if (target !== view){
    go({ view: target, calMode: false, blocks: false });
  }
}));

/* logo = back; clicking the calendar itself (not just scrolling) brings its side panel back */
document.getElementById('brand').addEventListener('click', back);
/* capture phase: runs before an event block's own click opens the editor,
   so this step never closes the overlay that's about to open */
document.getElementById('view-calendar').addEventListener('click', () => {
  if (!getState().calMode) go({ calMode: true, blocks: false });
}, true);

/* side panel "Time Blocks": switch to the blocks panel (Back returns to the calendar panel) */
document.getElementById('cal-blocks').addEventListener('click', () => {
  if (!getState().blocks) go({ blocks: true });
});

/* side panel "Events": new event today, at the next full hour */
document.getElementById('cal-new-event').addEventListener('click', () => {
  const h = Math.min(new Date().getHours() + 1, 23);
  openEventEditor({ date: isoDate(new Date()), start: fromHours(h), end: fromHours(h + 1) });
});

document.querySelectorAll('.nav-cal [data-soon]').forEach(btn =>
  btn.addEventListener('click', () => toast(btn.dataset.soon + ' — coming soon')));
