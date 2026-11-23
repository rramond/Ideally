import { store } from '../lib/storage.js';
import { back, anyPopupOpen } from '../lib/history.js';
import { toast } from '../lib/toast.js';
import { attachColorWheel } from '../colorWheel.js';
import { getProject, saveProject, deleteProject, onProjectsChange } from './projects.js';
import { mountNotes } from './projectNotes.js';
import { mountTimeline } from './timeline.js';
import { mountFiles, addFiles } from './projectFiles.js';

/* ============================================================
   PROJECT FULL SCREEN (2c) — the app on a smaller scale, for one
   project: its droplet (click: color wheel) and name (click to
   rename) on top, a mini side rail with Notes · Timeline · Files,
   the open section beside it. Opening grows the page out of the
   clicked droplet. Files dropped anywhere on the page, or pasted,
   are attached. Esc / the logo go back to the droplets.
============================================================ */
const page = document.getElementById('pj-page');
const SECTIONS = [
  { id: 'notes', label: 'Notes', icon: '<path d="M4 4h13l3 3v13H4z"/><path d="M8 9h8M8 13h8M8 17h5"/>', count: p => (p.notes || []).length },
  { id: 'timeline', label: 'Timeline', icon: '<path d="M3 12h18"/><circle cx="7" cy="12" r="2"/><circle cx="15" cy="12" r="2"/><path d="M7 6v4M15 14v4"/>', count: p => (p.timeline || []).length },
  { id: 'files', label: 'Files', icon: '<path d="M21 12.5l-8.5 8.5a5 5 0 0 1-7-7L14 5.5a3.3 3.3 0 0 1 4.7 4.7L10.2 18.7a1.7 1.7 0 0 1-2.4-2.4L15.5 8.6"/>', count: p => (p.files || []).length }
];
const MOUNT = { notes: mountNotes, timeline: mountTimeline, files: mountFiles };
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

const el = (tag, cls, text) => {
  const x = document.createElement(tag);
  if (cls) x.className = cls;
  if (text != null) x.textContent = text;
  return x;
};
const editing = () => { const a = document.activeElement; return a && (/INPUT|TEXTAREA|SELECT/.test(a.tagName) || a.isContentEditable); };

let openId = null, section = null, mounted = null, destroyWheel = null;
let ui = null;   // { drop, name, stats, rail: {id: btn}, body, dropZone }
const sectionOf = store.get('ideally.projectSections', {});

/* called by projectsView.js: show the project's page (origin: the droplet it opens from), or hide it */
export function showProjectPage(id, origin){
  if (id === openId){ if (id) refresh(); return; }
  teardown();
  openId = id;
  page.hidden = !id;
  if (!id) return;
  build();
  openSection(sectionOf[id] && MOUNT[sectionOf[id]] ? sectionOf[id] : 'notes');
  refresh();
  if (origin && !matchMedia('(prefers-reduced-motion: reduce)').matches){
    const R = Math.hypot(Math.max(origin.x, page.clientWidth - origin.x), Math.max(origin.y, page.clientHeight - origin.y));
    page.animate(
      [{ clipPath: 'circle(' + origin.r + 'px at ' + origin.x + 'px ' + origin.y + 'px)', opacity: 0.6 },
       { clipPath: 'circle(' + R + 'px at ' + origin.x + 'px ' + origin.y + 'px)', opacity: 1 }],
      { duration: 460, easing: 'cubic-bezier(.6,0,.2,1)' });
  }
}

function teardown(){
  if (mounted) mounted.destroy();
  if (destroyWheel) destroyWheel();
  mounted = destroyWheel = ui = null;
  section = null;
  page.innerHTML = '';
}

function build(){
  const p = getProject(openId);
  page.style.setProperty('--pc', p.color);
  const head = el('header', 'pj-head');
  const wrap = el('div', 'ee-type-wrap pj-drop-wrap');
  const drop = el('button', 'pj-page-drop');
  drop.type = 'button';
  drop.title = 'Project color';
  wrap.appendChild(drop);
  const name = el('h1', 'ee-name pj-page-name');
  name.title = 'Click to rename the project';
  const stats = el('span', 'pj-stats');
  head.append(wrap, name, stats);

  const body = el('div', 'pj-body');
  const rail = el('nav', 'pj-rail');
  rail.appendChild(el('div', 'nav-label', 'Project'));
  const railBtns = {};
  SECTIONS.forEach(s => {
    const b = el('button', 'nav-btn');
    b.type = 'button';
    b.innerHTML = '<svg viewBox="0 0 24 24">' + s.icon + '</svg>';
    b.append(el('span', 'pj-rail-label', s.label), el('span', 'pj-rail-count'));
    b.addEventListener('click', () => openSection(s.id));
    rail.appendChild(b);
    railBtns[s.id] = b;
  });
  rail.appendChild(el('span', 'pj-grow'));
  const del = el('button', 'danger-link pj-delete', 'delete project');
  del.type = 'button';
  del.addEventListener('click', () => {
    const pr = getProject(openId);
    if (!pr || !confirm('Delete the project “' + pr.name + '” with all its notes, timeline and files? This can\'t be undone.')) return;
    deleteProject(pr.id);          // the change listener goes back to the droplets
    toast('Deleted project “' + pr.name + '”');
  });
  rail.appendChild(del);
  const content = el('div', 'pj-content');
  body.append(rail, content);

  const dropZone = el('div', 'pj-dropzone');
  dropZone.hidden = true;
  dropZone.appendChild(el('div', 'pj-dropzone-inner'));
  page.append(head, body, dropZone);
  ui = { drop, name, stats, railBtns, content, dropZone };

  /* color: live */
  destroyWheel = attachColorWheel(drop, () => (getProject(openId) || p).color, hex => {
    const pr = getProject(openId);
    if (pr && pr.color !== hex) saveProject({ ...pr, color: hex });
  });

  /* name: click selects it all; Enter / clicking away saves, Esc reverts */
  name.addEventListener('click', () => {
    if (name.isContentEditable) return;
    name.contentEditable = 'true';
    name.focus();
    const r = document.createRange();
    r.selectNodeContents(name);
    getSelection().removeAllRanges(); getSelection().addRange(r);
  });
  name.addEventListener('keydown', e => {
    if (e.key === 'Enter'){ e.preventDefault(); name.blur(); }
    else if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); name.textContent = getProject(openId)?.name || ''; name.blur(); }
  });
  name.addEventListener('paste', e => {
    e.preventDefault();
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain').replace(/\s+/g, ' '));
  });
  name.addEventListener('blur', () => {
    name.contentEditable = 'false';
    const pr = getProject(openId);
    const n = name.textContent.trim().slice(0, 40);
    if (pr && n && n !== pr.name) saveProject({ ...pr, name: n });
    else if (pr) name.textContent = pr.name;
  });
}

function openSection(id){
  if (!ui || id === section) return;
  if (mounted) mounted.destroy();
  section = id;
  sectionOf[openId] = id;
  store.set('ideally.projectSections', sectionOf);
  Object.entries(ui.railBtns).forEach(([k, b]) => b.classList.toggle('active', k === id));
  ui.content.innerHTML = '';
  ui.content.className = 'pj-content pj-sec-' + id;
  mounted = MOUNT[id](ui.content, openId);
}

/* header + rail counts follow the data (the sections redraw themselves) */
function refresh(){
  const p = getProject(openId);
  if (!p || !ui) return;
  page.style.setProperty('--pc', p.color);
  ui.drop.style.setProperty('--pc', p.color);
  if (!ui.name.isContentEditable) ui.name.textContent = p.name;
  SECTIONS.forEach(s => { const n = s.count(p); ui.railBtns[s.id].querySelector('.pj-rail-count').textContent = n || ''; });
  const parts = [plural((p.notes || []).length, 'note'), plural((p.timeline || []).length, 'milestone'), plural((p.files || []).length, 'file')];
  ui.stats.textContent = parts.join(' · ').toUpperCase();
}

onProjectsChange(() => {
  if (!openId) return;
  if (!getProject(openId)){ teardown(); openId = null; page.hidden = true; back(); return; }
  refresh();
});

/* ---- keys: Esc leaves a text field first, then goes back to the droplets
   (pop-ups close first: this runs in the capture phase, before the history
   module's own Esc handler) ---- */
window.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !openId || page.hidden || anyPopupOpen()) return;
  if (editing()){
    if (!document.activeElement.isContentEditable) document.activeElement.blur();   // contentEditable names revert themselves
    return;
  }
  back();
}, true);

/* ---- files: drop anywhere on the page, or paste ---- */
let dragDepth = 0;
const hasFiles = e => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
async function attach(list){
  const id = openId;
  if (!id || !list.length) return;
  if (section !== 'files') openSection('files');
  if (await addFiles(id, list) && section === 'files' && openId === id) mounted.refresh();
}
page.addEventListener('dragenter', e => {
  if (!hasFiles(e) || !ui) return;
  e.preventDefault();
  if (dragDepth++ === 0){
    ui.dropZone.firstChild.textContent = 'Drop to attach to “' + (getProject(openId) || {}).name + '”';
    ui.dropZone.hidden = false;
  }
});
page.addEventListener('dragover', e => { if (hasFiles(e)){ e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
page.addEventListener('dragleave', e => {
  if (!hasFiles(e) || !ui) return;
  if (--dragDepth <= 0){ dragDepth = 0; ui.dropZone.hidden = true; }
});
page.addEventListener('drop', e => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth = 0;
  if (ui) ui.dropZone.hidden = true;
  attach([...e.dataTransfer.files]);
});
document.addEventListener('paste', e => {
  if (!openId || page.hidden || editing() || anyPopupOpen()) return;
  const list = [...(e.clipboardData?.files || [])];
  if (!list.length) return;
  e.preventDefault();
  attach(list);
});
