import { uid } from '../lib/utils.js';
import { openPopup, closePopup } from '../lib/history.js';
import { addCloseX } from '../lib/popups.js';
import { toast } from '../lib/toast.js';
import { attachColorWheel } from '../colorWheel.js';
import { suggestColor, saveProject, deleteProject } from './projects.js';

/* ============================================================
   PROJECT OVERLAY (2b) — a new project's name and color, or
   edit / delete an existing one. Same look as the event overlay.
============================================================ */
const EDITOR = 'project-editor';

const el = (tag, cls, text) => {
  const x = document.createElement(tag);
  if (cls) x.className = cls;
  if (text != null) x.textContent = text;
  return x;
};
const pulse = node => { node.classList.remove('pulse'); void node.offsetWidth; node.classList.add('pulse'); };

const TEMPLATE =
  '<div class="ee-head">' +
    '<h2 class="ee-name" title="Click to name the project"></h2>' +
    '<div class="ee-type-wrap pe-color-wrap"><button class="ee-type pj-color" type="button" title="Project color"></button></div>' +
  '</div>' +
  '<p class="pe-note">The circle grows as the project fills up with stickies, notes, roadmap items and files.</p>' +
  '<div class="ee-foot">' +
    '<button class="danger-link ee-delete" type="button"></button>' +
    '<span class="ee-hint"></span>' +
    '<button class="primary-btn ee-save" type="button"></button>' +
  '</div>';

/* onSaved(project) runs after Create / Save */
export function openProjectEditor({ project = null, onSaved } = {}){
  closePopup(EDITOR);
  const editing = !!project;
  const draft = editing
    ? { ...project }
    : { id: uid(), name: '', color: suggestColor(), created: Date.now() };

  const overlay = el('div', 'ev-overlay');
  const card = el('div', 'ev-card pj-card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-label', editing ? 'Edit project' : 'New project');
  card.innerHTML = TEMPLATE;
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const $ = sel => card.querySelector(sel);
  const nameEl = $('.ee-name'), colorBtn = $('.pj-color');
  const delBtn = $('.ee-delete'), saveBtn = $('.ee-save');

  const close = () => closePopup(EDITOR);
  let destroyWheel = null;
  openPopup(EDITOR, () => { if (destroyWheel) destroyWheel(); overlay.remove(); });
  addCloseX(card, close);
  overlay.addEventListener('pointerdown', e => { if (e.target === overlay) close(); });

  /* ---- name: click selects it all and starts typing ---- */
  const showName = () => {
    nameEl.textContent = draft.name || 'New project';
    nameEl.classList.toggle('placeholder', !draft.name);
  };
  nameEl.addEventListener('click', () => {
    if (nameEl.isContentEditable) return;
    nameEl.contentEditable = 'true';
    nameEl.focus();
    const r = document.createRange();
    r.selectNodeContents(nameEl);
    const sel = getSelection();
    sel.removeAllRanges(); sel.addRange(r);
  });
  nameEl.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); nameEl.blur(); } });
  nameEl.addEventListener('paste', e => {
    e.preventDefault();
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain').replace(/\s+/g, ' '));
  });
  nameEl.addEventListener('input', () => {
    nameEl.classList.remove('placeholder');
    draft.name = nameEl.textContent.trim();
    refresh();
  });
  nameEl.addEventListener('blur', () => {
    nameEl.contentEditable = 'false';
    draft.name = nameEl.textContent.trim();
    showName(); refresh();
  });

  /* ---- color ---- */
  const showColor = () => {
    colorBtn.style.background = draft.color;
    colorBtn.style.setProperty('--tc', draft.color);
  };
  destroyWheel = attachColorWheel(colorBtn, () => draft.color, hex => { draft.color = hex; showColor(); });

  /* ---- save / delete ---- */
  const refresh = () => saveBtn.setAttribute('aria-disabled', draft.name ? 'false' : 'true');
  function trySave(){
    if (!draft.name){ pulse(nameEl); return; }
    saveProject({ ...draft });
    close();
    if (onSaved) onSaved(draft);
  }
  saveBtn.textContent = editing ? 'Save' : 'Create';
  saveBtn.addEventListener('click', trySave);
  card.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)){ e.preventDefault(); trySave(); } });

  if (editing){
    delBtn.textContent = 'delete project';
    delBtn.addEventListener('click', () => {
      deleteProject(draft.id);
      close();
      toast('Deleted project “' + draft.name + '”');
    });
  } else {
    delBtn.hidden = true;
  }

  showName(); showColor(); refresh();
}
