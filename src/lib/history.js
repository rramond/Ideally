/* ============================================================
   Back navigation (GENERAL a) — every tab switch and pop-up is a
   browser history step, so the Ideally logo, the browser's Back,
   the mouse back button and Alt+← all behave the same.

   State: { view, calMode, blocks, periods, types, typeId, popups, depth }
   - blocks / periods / types: the calendar side panel shows the Time
     Blocks / Periods / Types list; typeId: the type open in the main
     area (3h)
   - popups: ids of the pop-ups open at that step, oldest first.
     Pop-ups can nest (overlay → type picker → color wheel).
   - Going back closes every pop-up the target step doesn't have.
   - A pop-up closed some other way (Esc, x, click outside) leaves
     steps behind that would change nothing; Back skips those, so
     it never seems to do nothing.
============================================================ */
let current = null;      // state of the current history entry
let shown = null;        // { view, calMode } actually on screen
let initialState = null;
let applyState = () => {};
const openNow = new Map(); // pop-up id → hide(), in opening order

export const getState = () => current;

const sameView = (a, b) => a.view === b.view && !!a.calMode === !!b.calMode
  && !!a.blocks === !!b.blocks && !!a.periods === !!b.periods && !!a.types === !!b.types
  && (a.typeId || null) === (b.typeId || null);
const viewOf = s => ({ view: s.view, calMode: s.calMode, blocks: s.blocks, periods: s.periods, types: s.types, typeId: s.typeId || null });

/* hide pop-ups newest first, without touching history */
function hideAll(ids){
  [...ids].reverse().forEach(id => {
    const hide = openNow.get(id);
    openNow.delete(id);
    if (hide) hide();
  });
}

export function initHistory(initial, apply){
  applyState = apply;
  initialState = { ...initial, popups: [], depth: 0 };
  /* a reload keeps the browser's state: reopen the same view */
  const saved = history.state && history.state.view ? history.state : null;
  current = saved
    ? { ...initialState, ...viewOf(saved), depth: saved.depth || 0 }
    : initialState;
  history.replaceState(current, '');
  shown = viewOf(current);
  applyState(current);

  window.addEventListener('popstate', e => {
    const next = e.state && e.state.view ? e.state : initialState;
    const goingBack = next.depth < current.depth;
    current = next;
    const keep = new Set(next.popups || []);
    const toClose = [...openNow.keys()].filter(id => !keep.has(id));
    hideAll(toClose);
    const same = sameView(next, shown);
    if (goingBack && same && !toClose.length && next.depth > 0){ history.back(); return; }
    if (!same){
      shown = viewOf(next);
      applyState(next);
    }
  });

  /* Esc closes the newest pop-up */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && openNow.size) closePopup([...openNow.keys()].pop());
  });
}

/* a new navigation step (closes any open pop-ups) */
export function go(partial){
  hideAll([...openNow.keys()]);
  current = { ...current, ...partial, popups: [], depth: current.depth + 1 };
  history.pushState(current, '');
  shown = viewOf(current);
  applyState(current);
}

/* change the current step in place — no new Back stop (opening another type
   while one is open, 3h: Back then returns to the calendar, not to that type) */
export function replace(partial){
  hideAll([...openNow.keys()]);
  current = { ...current, ...partial, popups: [] };
  history.replaceState(current, '');
  shown = viewOf(current);
  applyState(current);
}

export function back(){
  if (current.depth > 0) history.back();
}

export const isPopupOpen = id => openNow.has(id);
export const anyPopupOpen = () => openNow.size > 0;

/* hide(): take the pop-up off screen; called when going back or closing */
export function openPopup(id, hide){
  if (openNow.has(id)) closePopup(id);
  openNow.set(id, hide);
  current = { ...current, popups: [...(current.popups || []), id], depth: current.depth + 1 };
  history.pushState(current, '');
}

/* close a pop-up from the UI (x, Esc, click outside, Create…) — also closes
   any pop-ups opened on top of it */
export function closePopup(id){
  if (!openNow.has(id)) return;
  const ids = [...openNow.keys()];
  const closing = ids.slice(ids.indexOf(id));
  hideAll(closing);
  current = { ...current, popups: (current.popups || []).filter(x => !closing.includes(x)) };
  history.replaceState(current, '');
}
