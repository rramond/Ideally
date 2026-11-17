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
import './calendar/periodsPanel.js';
import { showTypeView } from './calendar/typeLibrary.js';
import { renderArrows, renderHandles } from './board.js';
import './timer/timer.js';
import { resizeSceneCanvas, ensureSceneLoop } from './timer/scenes.js';
import { initHistory, go, back, getState } from './lib/history.js';
import { isoDate, fromHours } from './lib/dates.js';

/* ============================================================
   View switching
============================================================ */
const sidebar = document.querySelector('.sidebar');
const calView = document.getElementById('view-calendar');
/* the calendar side panel's sub-panels are exclusive; an open type (3h) belongs to the Types panel */
const PANEL_OFF = { blocks: false, periods: false, types: false, typeId: null };
const views = document.querySelectorAll('.view');
const navBtns = document.querySelectorAll('.nav-main .nav-btn');

function applyState({ view, calMode, blocks, periods, types, typeId }){
  navBtns.forEach(b => b.classList.toggle('active', b.dataset.view === view));
  views.forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  if (view === 'board'){ renderArrows(); renderHandles(); }
  if (view === 'timer'){ resizeSceneCanvas(); ensureSceneLoop(); }
  /* the calendar replaces the main menu with its own side panel */
  sidebar.classList.toggle('cal-mode', view === 'calendar' && !!calMode);
  sidebar.classList.toggle('blocks-mode', view === 'calendar' && !!calMode && !!blocks);
  sidebar.classList.toggle('periods-mode', view === 'calendar' && !!calMode && !!periods);
  sidebar.classList.toggle('types-mode', view === 'calendar' && !!calMode && !!types);
  /* 3h: an open type replaces the week inside the calendar view */
  const openType = view === 'calendar' ? typeId || null : null;
  calView.classList.toggle('type-open', !!openType);
  showTypeView(openType);
}
initHistory({ view: 'notes', calMode: false, ...PANEL_OFF }, applyState);

navBtns.forEach(btn => btn.addEventListener('click', () => {
  const { view } = getState();
  const target = btn.dataset.view;
  if (target === 'calendar'){
    /* two steps, so Back first leaves the side panel (calendar still in view),
       then returns to the previous tab */
    if (view !== 'calendar') go({ view: 'calendar', calMode: false, ...PANEL_OFF });
    if (!getState().calMode) go({ calMode: true, ...PANEL_OFF });
  } else if (target !== view){
    go({ view: target, calMode: false, ...PANEL_OFF });
  }
}));

/* logo = back; clicking the calendar itself (not just scrolling) brings its side panel back */
document.getElementById('brand').addEventListener('click', back);
/* capture phase: runs before an event block's own click opens the editor,
   so this step never closes the overlay that's about to open */
calView.addEventListener('click', () => {
  if (!getState().calMode) go({ calMode: true, ...PANEL_OFF });
}, true);

/* side panel "Time Blocks": switch to the blocks panel (Back returns to the calendar panel) */
document.getElementById('cal-blocks').addEventListener('click', () => {
  if (!getState().blocks) go({ ...PANEL_OFF, blocks: true });
});

/* side panel "Events": new event today, at the next full hour */
document.getElementById('cal-new-event').addEventListener('click', () => {
  const h = Math.min(new Date().getHours() + 1, 23);
  openEventEditor({ date: isoDate(new Date()), start: fromHours(h), end: fromHours(h + 1) });
});

/* side panel "Periods": switch to the periods panel (Back returns to the calendar panel) */
document.getElementById('cal-periods').addEventListener('click', () => {
  if (!getState().periods) go({ ...PANEL_OFF, periods: true });
});

/* side panel "Types" (3h): switch to the type library panel (Back returns to the calendar panel) */
document.getElementById('cal-types').addEventListener('click', () => {
  if (!getState().types) go({ ...PANEL_OFF, types: true });
});
