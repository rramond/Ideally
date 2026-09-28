import { store } from './lib/storage.js';
import { uid } from './lib/utils.js';

/* ============================================================
   NOTES
============================================================ */
let notes = store.get('ideally.notes', []);
let activeNoteId = notes.length ? notes[0].id : null;
const noteItemsEl = document.getElementById('note-items');
const editorEl = document.getElementById('editor');
let saveTimer = null;

function fmtDate(ts){
  return new Date(ts).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}
function saveNotes(){ store.set('ideally.notes', notes); }

function renderNoteList(){
  noteItemsEl.innerHTML = '';
  if (!notes.length){
    const p = document.createElement('div');
    p.style.cssText = 'padding:14px 12px;font-size:12.5px;color:var(--muted)';
    p.textContent = 'No notes yet.';
    noteItemsEl.appendChild(p);
    return;
  }
  notes.forEach(n => {
    const btn = document.createElement('button');
    btn.className = 'note-item' + (n.id === activeNoteId ? ' active' : '');
    const snippet = (n.body || '').split('\n')[0].slice(0, 60);
    btn.innerHTML = '<div class="ni-title"></div><div class="ni-snippet"></div><div class="ni-meta"></div>';
    btn.querySelector('.ni-title').textContent = n.title || 'Untitled';
    btn.querySelector('.ni-snippet').textContent = snippet || '—';
    btn.querySelector('.ni-meta').textContent = fmtDate(n.updated);
    btn.addEventListener('click', () => { activeNoteId = n.id; renderNoteList(); renderEditor(); });
    noteItemsEl.appendChild(btn);
  });
}

function renderEditor(){
  const note = notes.find(n => n.id === activeNoteId);
  if (!note){
    editorEl.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<p>A blank page is an invitation.</p>';
    const b = document.createElement('button');
    b.className = 'ghost-btn'; b.textContent = 'Create a note';
    b.addEventListener('click', createNote);
    empty.appendChild(b);
    editorEl.appendChild(empty);
    return;
  }
  editorEl.innerHTML =
    '<div class="editor-inner">' +
      '<div class="editor-date" id="editor-date"></div>' +
      '<input id="note-title" placeholder="Untitled" autocomplete="off">' +
      '<textarea id="note-body" placeholder="Start writing…"></textarea>' +
    '</div>' +
    '<div class="editor-bar"><button class="danger-link" id="delete-note">delete note</button></div>';
  document.getElementById('editor-date').textContent = 'Edited ' + fmtDate(note.updated);
  const titleEl = document.getElementById('note-title');
  const bodyEl  = document.getElementById('note-body');
  titleEl.value = note.title;
  bodyEl.value  = note.body;

  const onInput = () => {
    note.title = titleEl.value;
    note.body  = bodyEl.value;
    note.updated = Date.now();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      notes.sort((a,b) => b.updated - a.updated);
      saveNotes(); renderNoteList();
      document.getElementById('editor-date').textContent = 'Edited ' + fmtDate(note.updated);
    }, 400);
  };
  titleEl.addEventListener('input', onInput);
  bodyEl.addEventListener('input', onInput);
  document.getElementById('delete-note').addEventListener('click', () => {
    if (!confirm('Delete this note? This can\'t be undone.')) return;
    notes = notes.filter(n => n.id !== note.id);
    activeNoteId = notes.length ? notes[0].id : null;
    saveNotes(); renderNoteList(); renderEditor();
  });
}

function createNote(){
  const n = { id: uid(), title: '', body: '', updated: Date.now() };
  notes.unshift(n);
  activeNoteId = n.id;
  saveNotes(); renderNoteList(); renderEditor();
  const t = document.getElementById('note-title');
  if (t) t.focus();
}
document.getElementById('new-note-btn').addEventListener('click', createNote);
renderNoteList(); renderEditor();
