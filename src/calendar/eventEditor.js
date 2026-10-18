import { uid, clamp } from '../lib/utils.js';
import { pad, parseIso, addDays, isoDate, toHours, fromHours } from '../lib/dates.js';
import { openPopup, closePopup, isPopupOpen } from '../lib/history.js';
import { addCloseX } from '../lib/popups.js';
import { toast } from '../lib/toast.js';
import { attachColorWheel } from '../colorWheel.js';
import { RECURRENCE, getTypes, typeOf, saveType, deleteType, lastTypeId, rememberType, saveEvent, deleteEvent } from './events.js';

/* ============================================================
   NEW EVENT OVERLAY (3c.1) — also used to edit an event
============================================================ */
const EDITOR = 'event-editor', PICKER = 'event-type-picker';
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const el = (tag, cls, text) => {
  const x = document.createElement(tag);
  if (cls) x.className = cls;
  if (text != null) x.textContent = text;
  return x;
};
const pulse = node => { node.classList.remove('pulse'); void node.offsetWidth; node.classList.add('pulse'); };

/* "9" → 09:00, "930" → 09:30, "9:5" → 09:05; 24:00 is allowed only as an end time */
function parseTime(str, isEnd){
  const s = str.trim();
  let h, m;
  if (s.includes(':')) [h, m] = s.split(':').map(x => (x === '' ? 0 : Number(x)));
  else if (/^\d{1,2}$/.test(s)){ h = +s; m = 0; }
  else if (/^\d{3,4}$/.test(s)){ h = +s.slice(0, -2); m = +s.slice(-2); }
  else return null;
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || m < 0 || m > 59) return null;
  if (h > 23 && !(isEnd && h === 24 && m === 0)) return null;
  return pad(h) + ':' + pad(m);
}

const TEMPLATE =
  '<div class="ee-head">' +
    '<h2 class="ee-name" title="Click to name the event"></h2>' +
    '<div class="ee-type-wrap"><button class="ee-type" type="button"></button></div>' +
  '</div>' +
  '<div class="ee-date">' +
    '<button class="icon-btn ee-day-prev" type="button" title="Previous day"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>' +
    '<span class="ee-date-label"></span>' +
    '<button class="icon-btn ee-day-next" type="button" title="Next day"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>' +
  '</div>' +
  '<div class="ee-times">' +
    '<label class="ee-field"><span>Start</span><input class="ee-time ee-start" inputmode="numeric" maxlength="5" autocomplete="off"></label>' +
    '<label class="ee-field"><span>End</span><input class="ee-time ee-end" inputmode="numeric" maxlength="5" autocomplete="off"></label>' +
  '</div>' +
  '<label class="ee-field"><span>Description</span><textarea class="ee-desc" rows="3" placeholder="Add details…"></textarea></label>' +
  '<div class="ee-field"><span>Repeat</span><div class="ee-recur">' +
    '<select class="ee-recur-kind" aria-label="Repeat"></select>' +
    '<select class="ee-recur-n" aria-label="Every how many days"></select>' +
  '</div></div>' +
  '<div class="ee-foot">' +
    '<button class="danger-link ee-delete" type="button"></button>' +
    '<span class="ee-hint"></span>' +
    '<button class="primary-btn ee-save" type="button"></button>' +
  '</div>';

/* open for a new event ({ date, start, end }) or an existing one ({ event }) */
export function openEventEditor({ event = null, date, start = '09:00', end = '10:00' } = {}){
  closePopup(EDITOR);
  const editing = !!event;
  const draft = editing
    ? JSON.parse(JSON.stringify(event))
    : { id: uid(), title: '', date, start, end, description: '', typeId: lastTypeId(), recur: { kind: 'none' } };

  const overlay = el('div', 'ev-overlay');
  const card = el('div', 'ev-card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-label', editing ? 'Edit event' : 'New event');
  card.innerHTML = TEMPLATE;
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const $ = sel => card.querySelector(sel);
  const nameEl = $('.ee-name'), typeBtn = $('.ee-type'), dateLabel = $('.ee-date-label');
  const startIn = $('.ee-start'), endIn = $('.ee-end'), descIn = $('.ee-desc');
  const kindSel = $('.ee-recur-kind'), nSel = $('.ee-recur-n');
  const delBtn = $('.ee-delete'), hint = $('.ee-hint'), saveBtn = $('.ee-save');

  const close = () => closePopup(EDITOR);
  openPopup(EDITOR, () => overlay.remove());
  addCloseX(card, close);
  overlay.addEventListener('pointerdown', e => { if (e.target === overlay) close(); });

  /* ---- name: click selects it all and starts typing ---- */
  const showName = () => {
    nameEl.textContent = draft.title || 'New event';
    nameEl.classList.toggle('placeholder', !draft.title);
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
    draft.title = nameEl.textContent.trim();
    refresh();
  });
  nameEl.addEventListener('blur', () => {
    nameEl.contentEditable = 'false';
    draft.title = nameEl.textContent.trim();
    showName(); refresh();
  });

  /* ---- type circle ---- */
  const showType = () => {
    const t = typeOf(draft);
    typeBtn.style.background = t.color;
    typeBtn.style.setProperty('--tc', t.color);
    typeBtn.title = 'Type: ' + t.name;
  };
  typeBtn.addEventListener('click', () => toggleTypePicker(typeBtn, draft, showType));

  /* ---- date ---- */
  const showDate = () => {
    const d = parseIso(draft.date);
    dateLabel.textContent = DAY_NAMES[d.getDay()] + ' ' + pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear();
  };
  const shiftDay = n => { draft.date = isoDate(addDays(parseIso(draft.date), n)); showDate(); };
  $('.ee-day-prev').addEventListener('click', () => shiftDay(-1));
  $('.ee-day-next').addEventListener('click', () => shiftDay(1));

  /* ---- start / end (24-hour) ---- */
  function commitTime(input, key){
    const v = parseTime(input.value, key === 'end');
    if (!v || v === draft[key]){ input.value = draft[key]; return; }
    if (key === 'start'){
      /* moving the start keeps the duration */
      const dur = toHours(draft.end) - toHours(draft.start);
      draft.start = v;
      if (dur > 0){ draft.end = fromHours(Math.min(24, toHours(v) + dur)); endIn.value = draft.end; }
    } else {
      draft.end = v;
    }
    input.value = v;
    refresh();
  }
  [[startIn, 'start'], [endIn, 'end']].forEach(([input, key]) => {
    input.value = draft[key];
    input.addEventListener('blur', () => commitTime(input, key));
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown'){
        /* ±15 min (Shift: ±1 h) */
        e.preventDefault();
        const cur = parseTime(input.value, key === 'end') || draft[key];
        const step = (e.shiftKey ? 1 : 0.25) * (e.key === 'ArrowUp' ? 1 : -1);
        input.value = fromHours(clamp(toHours(cur) + step, 0, key === 'end' ? 24 : 23.75));
        commitTime(input, key);
      } else if (e.key === 'Enter'){
        e.preventDefault();
        commitTime(input, key);
        trySave();
      }
    });
  });

  /* ---- description ---- */
  descIn.value = draft.description || '';
  descIn.addEventListener('input', () => { draft.description = descIn.value; });

  /* ---- recurrence: daily, every x (2–6) days, weekly, biweekly, monthly ---- */
  RECURRENCE.forEach(([kind, label]) => kindSel.appendChild(new Option(label, kind)));
  for (let n = 2; n <= 6; n++) nSel.appendChild(new Option(n + ' days', n));
  kindSel.value = draft.recur.kind;
  nSel.value = draft.recur.n || 2;
  const showRecur = () => { nSel.hidden = kindSel.value !== 'everyN'; };
  const readRecur = () => {
    draft.recur = kindSel.value === 'everyN' ? { kind: 'everyN', n: Number(nSel.value) } : { kind: kindSel.value };
    showRecur();
  };
  kindSel.addEventListener('change', readRecur);
  nSel.addEventListener('change', readRecur);

  /* ---- save / delete ---- */
  const problem = () =>
    !draft.title ? 'name' : toHours(draft.end) <= toHours(draft.start) ? 'time' : null;
  function refresh(){
    const p = problem();
    saveBtn.setAttribute('aria-disabled', p ? 'true' : 'false');
    endIn.classList.toggle('invalid', p === 'time');
    hint.textContent = p === 'time' ? 'End must be after start' : '';
  }
  function trySave(){
    commitTime(startIn, 'start');
    commitTime(endIn, 'end');
    const p = problem();
    if (p === 'name'){ pulse(nameEl); return; }
    if (p === 'time'){ pulse(endIn); return; }
    rememberType(draft.typeId);
    saveEvent(draft);
    close();
  }
  saveBtn.textContent = editing ? 'Save' : 'Create';
  saveBtn.addEventListener('click', trySave);
  card.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)){ e.preventDefault(); trySave(); } });

  if (editing){
    delBtn.textContent = draft.recur.kind !== 'none' ? 'delete event (all repeats)' : 'delete event';
    delBtn.addEventListener('click', () => {
      deleteEvent(draft.id);
      close();
      toast('Deleted “' + draft.title + '”');
    });
  } else {
    delBtn.hidden = true;
  }

  showName(); showType(); showDate(); showRecur(); refresh();
}

/* ============================================================
   Event type picker: choose, add or edit types (name + color)
============================================================ */
function toggleTypePicker(typeBtn, draft, onPicked){
  if (isPopupOpen(PICKER)){ closePopup(PICKER); return; }
  const wrap = typeBtn.parentElement;
  const pop = el('div', 'tp-pop');
  pop.setAttribute('role', 'listbox');
  wrap.appendChild(pop);
  const wheels = [];
  const dropWheels = () => { wheels.splice(0).forEach(destroy => destroy()); };

  const onDown = e => {
    if (!pop.contains(e.target) && !typeBtn.contains(e.target) && !e.target.closest('[data-back]')) closePopup(PICKER);
  };
  openPopup(PICKER, () => {
    dropWheels();
    pop.remove();
    document.removeEventListener('pointerdown', onDown);
  });
  document.addEventListener('pointerdown', onDown);

  /* form: null, or { id?, name, color } while adding / editing a type */
  function render(form = null){
    dropWheels();
    pop.innerHTML = '';
    addCloseX(pop, () => closePopup(PICKER));

    getTypes().forEach(t => {
      const row = el('div', 'tp-row' + (t.id === draft.typeId ? ' on' : ''));
      row.tabIndex = 0;
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', t.id === draft.typeId);
      const dot = el('span', 'tp-dot');
      dot.style.background = t.color;
      const edit = el('button', 'tp-edit', '✎');
      edit.type = 'button';
      edit.title = 'Edit type';
      edit.addEventListener('click', e => { e.stopPropagation(); render({ ...t }); });
      row.append(dot, el('span', 'tp-name', t.name), edit);
      const pick = () => { draft.typeId = t.id; onPicked(); closePopup(PICKER); };
      row.addEventListener('click', pick);
      row.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); pick(); } });
      pop.appendChild(row);
    });

    if (!form){
      const add = el('button', 'tp-new', '+ New type');
      add.type = 'button';
      add.addEventListener('click', () => render({ name: '', color: '#C084FC' }));
      pop.appendChild(add);
      return;
    }

    const f = el('div', 'tp-form');
    const line = el('div', 'tp-form-row');
    const colorWrap = el('div', 'tp-color');
    const swatch = el('button', 'tp-swatch');
    swatch.type = 'button';
    swatch.title = 'Type color';
    swatch.style.background = form.color;
    colorWrap.appendChild(swatch);
    wheels.push(attachColorWheel(swatch, () => form.color, hex => { form.color = hex; swatch.style.background = hex; }));
    const nameIn = el('input', 'tp-name-in');
    nameIn.placeholder = 'Type name';
    nameIn.maxLength = 24;
    nameIn.value = form.name;
    line.append(colorWrap, nameIn);

    const actions = el('div', 'tp-form-actions');
    if (form.id && getTypes().length > 1){
      const del = el('button', 'danger-link', 'delete type');
      del.type = 'button';
      del.addEventListener('click', () => {
        deleteType(form.id);
        if (draft.typeId === form.id){ draft.typeId = getTypes()[0].id; onPicked(); }
        render();
      });
      actions.appendChild(del);
    }
    const cancel = el('button', 'ghost-btn', 'Cancel');
    cancel.type = 'button';
    cancel.addEventListener('click', () => render());
    const ok = el('button', 'primary-btn', form.id ? 'Save' : 'Add');
    ok.type = 'button';
    const submit = () => {
      const name = nameIn.value.trim();
      if (!name){ pulse(nameIn); nameIn.focus(); return; }
      const t = { id: form.id || uid(), name, color: form.color };
      saveType(t);
      if (!form.id) draft.typeId = t.id;   // a new type is picked right away
      onPicked();
      render();
    };
    ok.addEventListener('click', submit);
    nameIn.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); submit(); } });
    actions.append(cancel, ok);
    f.append(line, actions);
    pop.appendChild(f);
    nameIn.focus();
  }
  render();
}
