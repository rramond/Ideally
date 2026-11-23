import { uid } from '../lib/utils.js';
import { dayNumber } from '../lib/dates.js';
import { openPopup, closePopup } from '../lib/history.js';
import { addCloseX } from '../lib/popups.js';
import { toast } from '../lib/toast.js';
import { getProject, updateProject } from './projects.js';

/* ============================================================
   MILESTONE OVERLAY (2d) — a timeline item: name, a date (or a
   start → end span over several days), done, and a description.
   Same look as the event overlay.
============================================================ */
const EDITOR = 'milestone-editor';
const el = (tag, cls, text) => {
  const x = document.createElement(tag);
  if (cls) x.className = cls;
  if (text != null) x.textContent = text;
  return x;
};
const pulse = node => { node.classList.remove('pulse'); void node.offsetWidth; node.classList.add('pulse'); };
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

const TEMPLATE =
  '<div class="ee-head">' +
    '<h2 class="ee-name" title="Click to name it"></h2>' +
    '<span class="ms-dot"></span>' +
  '</div>' +
  '<div class="ms-dates">' +
    '<label class="ee-field"><span class="ms-start-label">Date</span><input class="ms-date ms-start" type="date" required></label>' +
    '<span class="pe-arrow ms-span-only">→</span>' +
    '<label class="ee-field ms-span-only"><span>Ends</span><input class="ms-date ms-end" type="date"></label>' +
    '<span class="pe-days ms-days"></span>' +
  '</div>' +
  '<div class="ms-checks">' +
    '<label class="pe-cancel"><input type="checkbox" class="ms-span"> Lasts several days</label>' +
    '<label class="pe-cancel"><input type="checkbox" class="ms-done"> Done</label>' +
  '</div>' +
  '<label class="ee-field"><span>Description</span><textarea class="ee-desc ms-desc" placeholder="What does reaching it mean?"></textarea></label>' +
  '<div class="ee-foot">' +
    '<button class="danger-link ee-delete" type="button"></button>' +
    '<span class="ee-hint"></span>' +
    '<button class="primary-btn ee-save" type="button"></button>' +
  '</div>';

/* item: an existing timeline item, or the fields of a new one ({ date }) */
export function openMilestoneEditor(projectId, item = {}, onDone){
  closePopup(EDITOR);
  const project = getProject(projectId);
  if (!project) return;
  const editing = !!item.id;
  const draft = { id: uid(), name: '', date: item.date, end: null, done: false, desc: '', ...item };

  const overlay = el('div', 'ev-overlay');
  const card = el('div', 'ev-card ms-card');
  card.style.setProperty('--pc', project.color);
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-label', editing ? 'Edit milestone' : 'New milestone');
  card.innerHTML = TEMPLATE;
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const $ = s => card.querySelector(s);
  const nameEl = $('.ee-name'), startIn = $('.ms-start'), endIn = $('.ms-end');
  const spanBox = $('.ms-span'), doneBox = $('.ms-done'), descIn = $('.ms-desc');
  const daysEl = $('.ms-days'), hintEl = $('.ee-hint'), saveBtn = $('.ee-save'), delBtn = $('.ee-delete');

  const close = () => closePopup(EDITOR);
  openPopup(EDITOR, () => overlay.remove());
  addCloseX(card, close);
  overlay.addEventListener('pointerdown', e => { if (e.target === overlay) close(); });

  /* name: click selects it all and starts typing */
  const showName = () => {
    nameEl.textContent = draft.name || (editing ? 'Untitled' : 'New milestone');
    nameEl.classList.toggle('placeholder', !draft.name);
  };
  const startRename = () => {
    if (nameEl.isContentEditable) return;
    nameEl.contentEditable = 'true';
    nameEl.focus();
    const r = document.createRange();
    r.selectNodeContents(nameEl);
    getSelection().removeAllRanges(); getSelection().addRange(r);
  };
  nameEl.addEventListener('click', startRename);
  nameEl.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); nameEl.blur(); } });
  nameEl.addEventListener('paste', e => {
    e.preventDefault();
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain').replace(/\s+/g, ' '));
  });
  nameEl.addEventListener('input', () => { nameEl.classList.remove('placeholder'); draft.name = nameEl.textContent.trim(); refresh(); });
  nameEl.addEventListener('blur', () => { nameEl.contentEditable = 'false'; draft.name = nameEl.textContent.trim(); showName(); refresh(); });

  /* dates */
  startIn.value = draft.date || '';
  endIn.value = draft.end || '';
  spanBox.checked = !!draft.end;
  doneBox.checked = !!draft.done;
  descIn.value = draft.desc || '';
  spanBox.addEventListener('change', () => {
    if (spanBox.checked && !endIn.value && startIn.value){
      endIn.value = new Date((dayNumber(startIn.value) + 6) * 86400000).toISOString().slice(0, 10);
    }
    refresh();
  });
  /* moving the start keeps the span's length */
  let lastStart = startIn.value;
  startIn.addEventListener('change', () => {
    if (spanBox.checked && lastStart && startIn.value && endIn.value){
      const len = dayNumber(endIn.value) - dayNumber(lastStart);
      endIn.value = new Date((dayNumber(startIn.value) + len) * 86400000).toISOString().slice(0, 10);
    }
    lastStart = startIn.value;
    refresh();
  });
  endIn.addEventListener('change', refresh);
  endIn.addEventListener('input', refresh);
  startIn.addEventListener('input', refresh);

  function problem(){
    if (!startIn.value) return 'Pick a date';
    if (spanBox.checked){
      if (!endIn.value) return 'Pick an end date';
      if (endIn.value < startIn.value) return 'It ends before it starts';
    }
    return '';
  }
  function refresh(){
    card.classList.toggle('span', spanBox.checked);
    $('.ms-start-label').textContent = spanBox.checked ? 'Starts' : 'Date';
    const p = problem();
    hintEl.textContent = p && (startIn.value || endIn.value) ? p : '';
    endIn.classList.toggle('invalid', spanBox.checked && !!endIn.value && endIn.value < startIn.value);
    daysEl.textContent = spanBox.checked && !p ? plural(dayNumber(endIn.value) - dayNumber(startIn.value) + 1, 'day') : '';
    saveBtn.setAttribute('aria-disabled', draft.name && !p ? 'false' : 'true');
  }

  function trySave(){
    if (nameEl.isContentEditable) draft.name = nameEl.textContent.trim();
    if (!draft.name){ pulse(nameEl); return; }
    if (problem()){ pulse(hintEl.textContent ? hintEl : startIn); refresh(); return; }
    const saved = {
      id: draft.id, name: draft.name, date: startIn.value,
      end: spanBox.checked && endIn.value !== startIn.value ? endIn.value : null,
      done: doneBox.checked, desc: descIn.value.trim()
    };
    updateProject(projectId, p => {
      const i = p.timeline.findIndex(x => x.id === saved.id);
      if (i < 0) p.timeline.push(saved); else p.timeline[i] = saved;
    });
    close();
    if (onDone) onDone();
  }
  saveBtn.textContent = editing ? 'Save' : 'Create';
  saveBtn.addEventListener('click', trySave);
  card.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)){ e.preventDefault(); trySave(); } });

  if (editing){
    delBtn.textContent = 'delete';
    delBtn.addEventListener('click', () => {
      updateProject(projectId, p => { p.timeline = p.timeline.filter(x => x.id !== draft.id); });
      close();
      toast('Deleted “' + draft.name + '”');
      if (onDone) onDone();
    });
  } else delBtn.hidden = true;

  showName(); refresh();
  if (!editing) startRename();
}
