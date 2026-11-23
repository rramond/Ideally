import { updateProject } from './projects.js';
import { HORIZONS, goalOf, byOrder, statusChip, goalChip, dateChip, progressBar } from './roadmap.js';

/* ============================================================
   ROADMAP · COLUMNS (2h) — Now / Next / Later, each with its
   count, like your first Jira photo. A card shows the name, the
   start of the description, its goal, status and date, and the
   steps' progress / number of documents. Drag a card to another
   column or place (the order is kept); click opens it; "+ Create"
   at the bottom of a column adds one there (Enter, keeps going).
============================================================ */
const el = (tag, cls, text) => {
  const x = document.createElement(tag);
  if (cls) x.className = cls;
  if (text != null) x.textContent = text;
  return x;
};
const DRAG_START = 5;

export function mountColumns(host, ctx){
  const wrap = el('div', 'rm-cols');
  host.appendChild(wrap);
  let typingIn = null;   // the column whose quick-create field is open

  function card(it){
    const p = ctx.project();
    const c = el('div', 'rm-card' + (ctx.isOpen(it.id) ? ' open' : '') + (it.status === 'done' ? ' done' : ''));
    c.dataset.id = it.id;
    c.tabIndex = 0;
    c.appendChild(el('div', 'rm-card-title', it.name));
    if (it.desc) c.appendChild(el('div', 'rm-card-desc', it.desc));
    const tags = el('div', 'rm-card-tags');
    const g = goalOf(p, it);
    if (g) tags.appendChild(goalChip(g));
    tags.append(statusChip(it), dateChip(it));
    c.appendChild(tags);
    const pr = progressBar(it), docs = it.docs.filter(d => d.kind === 'url' || (p.files || []).some(f => f.id === d.fileId)).length;
    if (pr || docs){
      const foot = el('div', 'rm-card-foot');
      if (pr) foot.appendChild(pr);
      if (docs){ const d = el('span', 'rm-card-docs', '▤ ' + docs); d.title = docs + ' document' + (docs === 1 ? '' : 's'); foot.appendChild(d); }
      c.appendChild(foot);
    }
    return c;
  }

  function render(){
    wrap.innerHTML = '';
    const items = ctx.items();
    HORIZONS.forEach(h => {
      const col = el('div', 'rm-col rm-h-' + h.id);
      col.dataset.h = h.id;
      const its = items.filter(i => i.horizon === h.id).sort(byOrder);
      const head = el('div', 'rm-col-head');
      head.append(el('span', 'rm-horizon rm-h-' + h.id, h.label), el('span', 'rm-col-count', String(its.length)));
      const list = el('div', 'rm-col-list');
      its.forEach(it => list.appendChild(card(it)));
      if (!its.length) list.appendChild(el('p', 'rm-col-empty', ctx.filtering() ? 'No matching items' : 'Nothing here yet'));
      col.append(head, list, quickCreate(h.id));
      wrap.appendChild(col);
    });
  }

  /* "+ Create" → a field; Enter adds the item and stays open for the next */
  function quickCreate(h){
    const box = el('div', 'rm-col-add');
    if (typingIn !== h){
      const b = el('button', 'rm-add-btn', '+ Create');
      b.type = 'button';
      b.addEventListener('click', () => { typingIn = h; render(); });
      box.appendChild(b);
      return box;
    }
    const inp = el('input', 'rm-add-in');
    inp.placeholder = 'Name, then Enter';
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter'){
        e.preventDefault();
        const v = inp.value.trim();
        if (v) ctx.create({ name: v, horizon: h });   // re-renders, with the field still open
      } else if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); typingIn = null; render(); }
    });
    inp.addEventListener('blur', () => setTimeout(() => { if (typingIn === h && !inp.value.trim() && document.activeElement !== inp){ typingIn = null; render(); } }, 120));
    box.appendChild(inp);
    requestAnimationFrame(() => inp.focus());
    return box;
  }

  /* ---- drag a card: to another column, or another place in one ---- */
  let press = null, drag = null;
  wrap.addEventListener('pointerdown', e => {
    const c = e.target.closest('.rm-card');
    if (!c || e.button !== 0) return;
    press = { c, id: c.dataset.id, x: e.clientX, y: e.clientY, ox: e.clientX - c.getBoundingClientRect().left, oy: e.clientY - c.getBoundingClientRect().top };
  });
  const onMove = e => {
    if (!press) return;
    if (!drag){
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < DRAG_START) return;
      const r = press.c.getBoundingClientRect();
      const ghost = press.c.cloneNode(true);
      ghost.classList.add('rm-card-ghost');
      ghost.style.width = r.width + 'px';
      document.body.appendChild(ghost);
      const ph = el('div', 'rm-placeholder');
      ph.style.height = r.height + 'px';
      press.c.classList.add('drag-src');
      press.c.after(ph);
      drag = { ghost, ph };
      document.body.classList.add('rm-dragging');
    }
    drag.ghost.style.transform = 'translate(' + (e.clientX - press.ox) + 'px,' + (e.clientY - press.oy) + 'px) rotate(1.5deg)';
    const col = document.elementFromPoint(e.clientX, e.clientY)?.closest('.rm-col');
    if (!col || !wrap.contains(col)) return;
    const list = col.querySelector('.rm-col-list');
    const before = [...list.querySelectorAll('.rm-card:not(.drag-src)')].find(c => { const r = c.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; });
    if (before) list.insertBefore(drag.ph, before); else list.appendChild(drag.ph);
  };
  const onUp = e => {
    if (!press) return;
    const p = press, d = drag;
    press = drag = null;
    document.body.classList.remove('rm-dragging');
    if (!d){ if (e && e.type === 'pointerup') ctx.open(p.id); return; }
    d.ghost.remove();
    if (!e || e.type !== 'pointerup'){ render(); return; }        // cancelled
    const list = d.ph.parentElement, col = list.closest('.rm-col');
    /* the visible cards on either side of the drop place (skipping the dragged one) */
    const sib = dir => { let n = d.ph[dir]; while (n && !(n.matches('.rm-card') && !n.classList.contains('drag-src'))) n = n[dir]; return n; };
    const next = sib('nextElementSibling'), prev = sib('previousElementSibling');
    const h = col.dataset.h;
    /* reorder the whole column (hidden, filtered-out items keep their places around it) */
    updateProject(ctx.projectId, pr => {
      const it = pr.timeline.find(x => x.id === p.id);
      if (!it) return;
      const colItems = pr.timeline.filter(x => x.horizon === h && x.id !== it.id).sort(byOrder);
      let i = next ? colItems.findIndex(x => x.id === next.dataset.id) : prev ? colItems.findIndex(x => x.id === prev.dataset.id) + 1 : colItems.length;
      if (i < 0) i = colItems.length;
      colItems.splice(i, 0, it);
      it.horizon = h;
      colItems.forEach((x, k) => { x.order = k; });
    });
    ctx.update(p.id, () => {});      // redraw everything (progress, panel stays)
  };
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
  const onKey = e => { if (e.key === 'Escape' && drag){ e.preventDefault(); e.stopPropagation(); onUp(null); } };
  document.addEventListener('keydown', onKey, true);
  wrap.addEventListener('keydown', e => {
    const c = e.target.closest('.rm-card');
    if (c && e.key === 'Enter'){ e.preventDefault(); ctx.open(c.dataset.id); }
  });

  return {
    render,
    destroy(){
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('keydown', onKey, true);
      if (drag) drag.ghost.remove();
      document.body.classList.remove('rm-dragging');
    }
  };
}
