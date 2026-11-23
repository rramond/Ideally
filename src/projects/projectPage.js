import { back, anyPopupOpen } from '../lib/history.js';
import { toast } from '../lib/toast.js';
import { attachColorWheel } from '../colorWheel.js';
import { getProject, saveProject, deleteProject, onProjectsChange, stickyCount } from './projects.js';
import { mountBoard } from './projectBoard.js';
import { mountNotes } from './projectNotes.js';
import { mountRoadmap } from './roadmapSection.js';
import { mountFiles, addFiles } from './projectFiles.js';

/* ============================================================
   PROJECT FULL SCREEN (2c) — the app on a smaller scale, for one
   project. While it's open the app's side panel becomes the
   project's (Board · Notes · Timeline · Files, delete project),
   like the calendar swaps in its own. On top of the page: the
   project's droplet (click: color wheel) and name (click to
   rename). It always opens on the Board (2f). Opening grows the
   page out of the clicked droplet. Files dropped anywhere on the
   page, or pasted, go on the board (in Files, they're just
   stored). Esc / the logo go back to the droplets.
============================================================ */
const page = document.getElementById('pj-page');
const sidebar = document.querySelector('.sidebar');
const navName = document.getElementById('nav-pj-name');
const navDot = document.getElementById('nav-pj-dot');
const navBtns = [...document.querySelectorAll('.nav-project .nav-btn[data-sec]')];
const SECTIONS = {
  board: { mount: mountBoard, count: p => p.board ? p.board.items.length : 0 },
  notes: { mount: mountNotes, count: p => (p.notes || []).length },
  timeline: { mount: mountRoadmap, count: p => (p.timeline || []).length },   // the Roadmap (2h)
  files: { mount: mountFiles, count: p => (p.files || []).length }
};
const plural = (n, w, many) => n + ' ' + (n === 1 ? w : many || w + 's');

const el = (tag, cls, text) => {
  const x = document.createElement(tag);
  if (cls) x.className = cls;
  if (text != null) x.textContent = text;
  return x;
};
const editing = () => { const a = document.activeElement; return a && (/INPUT|TEXTAREA|SELECT/.test(a.tagName) || a.isContentEditable); };

let openId = null, section = null, mounted = null, destroyWheel = null;
let ui = null;   // { drop, name, stats, content, dropZone }

/* called by projectsView.js: show the project's page (origin: the droplet it opens from), or hide it */
export function showProjectPage(id, origin){
  if (id === openId){ if (id) refresh(); return; }
  teardown();
  openId = id;
  page.hidden = !id;
  sidebar.classList.toggle('project-mode', !!id);
  if (!id) return;
  build();
  openSection('board');
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
  const content = el('div', 'pj-content');
  const dropZone = el('div', 'pj-dropzone');
  dropZone.hidden = true;
  dropZone.appendChild(el('div', 'pj-dropzone-inner'));
  page.append(head, content, dropZone);
  ui = { drop, name, stats, content, dropZone };

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
  navBtns.forEach(b => b.classList.toggle('active', b.dataset.sec === id));
  ui.content.innerHTML = '';
  ui.content.className = 'pj-content pj-sec-' + id;
  mounted = SECTIONS[id].mount(ui.content, openId);
}

/* the side panel (index.html, .nav-project) */
navBtns.forEach(b => b.addEventListener('click', () => openSection(b.dataset.sec)));
document.getElementById('nav-pj-delete').addEventListener('click', () => {
  const pr = getProject(openId);
  if (!pr || !confirm('Delete the project “' + pr.name + '” with its board, notes, timeline and files? This can\'t be undone.')) return;
  deleteProject(pr.id);          // the change listener goes back to the droplets
  toast('Deleted project “' + pr.name + '”');
});

/* header + side panel counts follow the data (the sections redraw themselves) */
function refresh(){
  const p = getProject(openId);
  if (!p || !ui) return;
  page.style.setProperty('--pc', p.color);
  sidebar.style.setProperty('--pc', p.color);
  ui.drop.style.setProperty('--pc', p.color);
  if (!ui.name.isContentEditable) ui.name.textContent = p.name;
  navName.textContent = p.name;
  navDot.style.background = p.color;
  navBtns.forEach(b => { b.querySelector('.pj-rail-count').textContent = SECTIONS[b.dataset.sec].count(p) || ''; });
  ui.stats.textContent = [
    plural(stickyCount(p), 'sticky', 'stickies'), plural((p.notes || []).length, 'note'),
    plural((p.timeline || []).length, 'roadmap item'), plural((p.files || []).length, 'file')
  ].join(' · ').toUpperCase();
}

onProjectsChange(() => {
  if (!openId) return;
  if (!getProject(openId)){ teardown(); openId = null; page.hidden = true; sidebar.classList.remove('project-mode'); back(); return; }
  refresh();
});

/* ---- keys: Esc leaves a text field first, then goes back to the droplets
   (pop-ups close first: this runs in the capture phase, before the history
   module's own Esc handler) ---- */
window.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !openId || page.hidden || anyPopupOpen()) return;
  if (editing()){
    if (!document.activeElement.isContentEditable) document.activeElement.blur();   // contentEditable fields handle Esc themselves
    return;
  }
  back();
}, true);

/* ---- files: drop anywhere on the page, or paste — onto the board, unless
   the Files section is open (then they're just stored) ---- */
let dragDepth = 0;
const hasFiles = e => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
async function attach(list, cx, cy){
  const id = openId;
  if (!id || !list.length) return;
  if (section === 'files'){
    if ((await addFiles(id, list)).length && section === 'files' && openId === id) mounted.refresh();
    return;
  }
  openSection('board');
  if (cx == null) mounted.pasteFiles(list);
  else mounted.dropFiles(list, cx, cy);
}
page.addEventListener('dragenter', e => {
  if (!hasFiles(e) || !ui) return;
  e.preventDefault();
  if (dragDepth++ === 0){
    ui.dropZone.firstChild.textContent = section === 'files'
      ? 'Drop to store in “' + (getProject(openId) || {}).name + '”'
      : 'Drop to pin on the board';
    ui.dropZone.classList.toggle('on-board', section === 'board');
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
  attach([...e.dataTransfer.files], e.clientX, e.clientY);
});
document.addEventListener('paste', e => {
  if (!openId || page.hidden || editing() || anyPopupOpen()) return;
  const list = [...(e.clipboardData?.files || [])];
  if (!list.length) return;
  e.preventDefault();
  attach(list);
});
