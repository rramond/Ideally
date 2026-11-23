import { uid } from '../lib/utils.js';
import { showContextMenu } from '../lib/contextMenu.js';
import { toast } from '../lib/toast.js';
import { getProject, updateProject } from './projects.js';

/* ============================================================
   PROJECT NOTES (2c) — the Notes tab on a smaller scale, inside
   one project: a list on the left (newest edit first) and the
   open note on the right. Typing saves after a short pause.
============================================================ */
const el = (tag, cls, text) => {
  const x = document.createElement(tag);
  if (cls) x.className = cls;
  if (text != null) x.textContent = text;
  return x;
};
const fmtDate = ts => new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

/* the open note of each project, while the app stays open */
const openNote = new Map();

export function mountNotes(root, projectId){
  const list = el('div', 'pj-notes-list');
  const head = el('div', 'pj-sec-head');
  const newBtn = el('button', 'ghost-btn pj-small-btn', '+ New note');
  newBtn.type = 'button';
  head.append(el('span', 'nav-label', 'Notes'), newBtn);
  const items = el('div', 'pj-note-items');
  list.append(head, items);
  const editor = el('div', 'pj-note-editor');
  root.append(list, editor);

  let saveTimer = null, dirty = null;
  const notes = () => (getProject(projectId) || {}).notes || [];
  const flush = () => {
    clearTimeout(saveTimer);
    if (!dirty) return;
    const { id, title, body } = dirty;
    dirty = null;
    updateProject(projectId, p => {
      const n = p.notes.find(x => x.id === id);
      if (!n) return;
      n.title = title; n.body = body; n.updated = Date.now();
      p.notes.sort((a, b) => b.updated - a.updated);
    });
    renderList();
  };

  function renderList(){
    items.innerHTML = '';
    const ns = notes();
    if (!ns.length){ items.appendChild(el('p', 'pj-empty-small', 'No notes yet.')); return; }
    ns.forEach(n => {
      const b = el('button', 'note-item' + (n.id === openNote.get(projectId) ? ' active' : ''));
      b.type = 'button';
      b.dataset.id = n.id;
      b.append(
        el('div', 'ni-title', n.title || 'Untitled'),
        el('div', 'ni-snippet', (n.body || '').split('\n')[0].slice(0, 60) || '—'),
        el('div', 'ni-meta', fmtDate(n.updated)));
      b.addEventListener('click', () => { flush(); openNote.set(projectId, n.id); renderList(); renderEditor(); });
      items.appendChild(b);
    });
  }

  function renderEditor(){
    editor.innerHTML = '';
    const note = notes().find(n => n.id === openNote.get(projectId));
    if (!note){
      const empty = el('div', 'pj-empty');
      empty.appendChild(el('p', null, notes().length ? 'Pick a note on the left.' : 'Ideas, decisions, loose ends — keep this project\'s notes here.'));
      const b = el('button', 'ghost-btn', 'Create a note');
      b.type = 'button';
      b.addEventListener('click', createNote);
      empty.appendChild(b);
      editor.appendChild(empty);
      return;
    }
    const inner = el('div', 'pj-note-inner');
    const date = el('div', 'editor-date', 'Edited ' + fmtDate(note.updated));
    const title = el('input', 'pj-note-title');
    title.placeholder = 'Untitled';
    title.autocomplete = 'off';
    title.value = note.title;
    const body = el('textarea', 'pj-note-body');
    body.placeholder = 'Start writing…';
    body.value = note.body;
    inner.append(date, title, body);
    const bar = el('div', 'editor-bar');
    const del = el('button', 'danger-link', 'delete note');
    del.type = 'button';
    del.addEventListener('click', () => removeNote(note.id));
    bar.appendChild(del);
    editor.append(inner, bar);

    const onInput = () => {
      dirty = { id: note.id, title: title.value, body: body.value };
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { flush(); date.textContent = 'Edited ' + fmtDate(Date.now()); }, 400);
    };
    title.addEventListener('input', onInput);
    body.addEventListener('input', onInput);
    title.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); body.focus(); } });
  }

  function createNote(){
    flush();
    const n = { id: uid(), title: '', body: '', updated: Date.now() };
    updateProject(projectId, p => { p.notes.unshift(n); });
    openNote.set(projectId, n.id);
    renderList(); renderEditor();
    editor.querySelector('.pj-note-title')?.focus();
  }

  function removeNote(id){
    flush();
    const n = notes().find(x => x.id === id);
    if (!n || !confirm('Delete the note “' + (n.title || 'Untitled') + '”? This can\'t be undone.')) return;
    updateProject(projectId, p => { p.notes = p.notes.filter(x => x.id !== id); });
    if (openNote.get(projectId) === id) openNote.set(projectId, notes()[0]?.id || null);
    renderList(); renderEditor();
    toast('Deleted note');
  }

  newBtn.addEventListener('click', createNote);
  items.addEventListener('contextmenu', e => {
    const item = e.target.closest('.note-item');
    if (!item) return;
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, [
      { label: 'Open note', action: () => item.click() },
      { label: 'Delete note', danger: true, action: () => removeNote(item.dataset.id) }
    ]);
  });

  if (!notes().some(n => n.id === openNote.get(projectId))) openNote.set(projectId, notes()[0]?.id || null);
  renderList(); renderEditor();

  return { destroy: flush, create: createNote };
}
