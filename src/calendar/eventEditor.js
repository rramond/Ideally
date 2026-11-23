import { uid, clamp } from '../lib/utils.js';
import { pad, parseIso, addDays, isoDate, toHours, fromHours } from '../lib/dates.js';
import { openPopup, closePopup, isPopupOpen } from '../lib/history.js';
import { addCloseX } from '../lib/popups.js';
import { toast } from '../lib/toast.js';
import { attachColorWheel } from '../colorWheel.js';
import { RECURRENCE, getTypes, typeOf, saveType, deleteType, lastTypeId, rememberType,
         saveEvent, deleteEvent, saveBlock, deleteBlock, overrideClash, suggestOverride, periodOf } from './events.js';
import { cancelledBy, getPeriods } from './periods.js';
import { themeColor } from '../themes/theme.js';

/* ============================================================
   NEW EVENT OVERLAY (3c.1) — also used to edit an event, and
   to create / edit time blocks (3c.2: a duration instead of a
   date, start and end)
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
const shortDate = iso => iso.slice(8, 10) + '.' + iso.slice(5, 7);   // 'YYYY-MM-DD' → 'DD.MM'

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

/* hours from start to end; an end before the start is on the next day */
const span = (start, end) => { const d = toHours(end) - toHours(start); return d < 0 ? d + 24 : d; };
/* the end time `dur` hours after start (wraps past midnight; exactly midnight → 24:00) */
const endAfter = (start, dur) => { const h = toHours(start) + dur; return fromHours(h > 24 ? h - 24 : h); };

const TEMPLATE =
  '<div class="ee-head">' +
    '<h2 class="ee-name"></h2>' +
    '<div class="ee-colors">' +
      '<div class="ee-type-wrap"><button class="ee-type" type="button"></button></div>' +
      '<span class="ee-ovr-link"></span>' +
      '<div class="ee-type-wrap ee-ovr-wrap">' +
        '<button class="ee-type ee-ovr" type="button"></button>' +
        '<button class="ee-ovr-x" type="button" title="Remove override" aria-label="Remove override color">×</button>' +
      '</div>' +
    '</div>' +
  '</div>' +
  '<div class="ee-date">' +
    '<button class="icon-btn ee-day-prev" type="button" title="Previous day"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>' +
    '<span class="ee-date-label"></span>' +
    '<button class="icon-btn ee-day-next" type="button" title="Next day"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>' +
  '</div>' +
  '<p class="ee-cancel-note" hidden></p>' +
  '<div class="ee-times">' +
    '<label class="ee-field"><span>Start</span><input class="ee-time ee-start" inputmode="numeric" maxlength="5" autocomplete="off"></label>' +
    '<label class="ee-field"><span>End</span><input class="ee-time ee-end" inputmode="numeric" maxlength="5" autocomplete="off"></label>' +
  '</div>' +
  '<div class="ee-field ee-dur-field"><span>Duration (h:mm)</span><div class="ee-dur-row">' +
    '<input class="ee-time ee-dur" inputmode="numeric" maxlength="5" autocomplete="off" aria-label="Duration (h:mm)">' +
    '<label class="ee-flex" title="For things without a set length (a walk, reading, studying): it lands as 1 hour and you drag its top / bottom edge on the calendar to fit">' +
      '<input type="checkbox" class="ee-flex-box"> No fixed duration</label>' +
  '</div></div>' +
  '<label class="ee-field"><span>Description</span><textarea class="ee-desc" rows="3" placeholder="Add details…"></textarea></label>' +
  '<div class="ee-field"><span>Repeat</span><div class="ee-recur">' +
    '<select class="ee-recur-kind" aria-label="Repeat"></select>' +
    '<select class="ee-recur-n" aria-label="Every how many days"></select>' +
  '</div></div>' +
  '<div class="ee-field ee-during-field"><span>During</span><div class="ee-during">' +
    '<i class="ee-period-dot" hidden></i>' +
    '<select class="ee-period" aria-label="During a period"></select>' +
  '</div></div>' +
  '<div class="ee-foot">' +
    '<button class="danger-link ee-delete" type="button"></button>' +
    '<span class="ee-hint"></span>' +
    '<button class="primary-btn ee-save" type="button"></button>' +
  '</div>';

/* open for a new event ({ date, start, end }) or an existing one ({ event }) */
export function openEventEditor({ event = null, date, start = '09:00', end = '10:00' } = {}){
  openEditor(false, event, { date, start, end });
}
/* open for a new time block, or an existing one ({ block }) */
export function openBlockEditor({ block = null } = {}){
  openEditor(true, block, { duration: '01:00' });
}

function openEditor(isBlock, item, fresh){
  closePopup(EDITOR);
  const editing = !!item;
  const noun = isBlock ? 'block' : 'event';
  const draft = editing
    ? JSON.parse(JSON.stringify(item))
    : { id: uid(), title: '', ...fresh, description: '', typeId: lastTypeId(), recur: { kind: 'none' }, created: Date.now() };

  const overlay = el('div', 'ev-overlay');
  const card = el('div', 'ev-card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-label', (editing ? 'Edit ' : 'New ') + noun);
  card.innerHTML = TEMPLATE;
  /* a block has a duration; an event has a date, start and end */
  if (isBlock){ ['.ee-date', '.ee-cancel-note', '.ee-times', '.ee-during-field'].forEach(s => card.querySelector(s).remove()); }
  else card.querySelector('.ee-dur-field').remove();
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const $ = sel => card.querySelector(sel);
  const nameEl = $('.ee-name'), typeBtn = $('.ee-type'), dateLabel = $('.ee-date-label'), cancelNote = $('.ee-cancel-note');
  const ovrBtn = $('.ee-ovr'), ovrX = $('.ee-ovr-x'), ovrLink = $('.ee-ovr-link');
  const startIn = $('.ee-start'), endIn = $('.ee-end'), durIn = $('.ee-dur'), descIn = $('.ee-desc');
  const kindSel = $('.ee-recur-kind'), nSel = $('.ee-recur-n'), periodSel = $('.ee-period'), periodDot = $('.ee-period-dot');
  const delBtn = $('.ee-delete'), hint = $('.ee-hint'), saveBtn = $('.ee-save');

  const close = () => closePopup(EDITOR);
  let destroyOvrWheel = null;
  openPopup(EDITOR, () => { if (destroyOvrWheel) destroyOvrWheel(); overlay.remove(); });
  addCloseX(card, close);
  overlay.addEventListener('pointerdown', e => { if (e.target === overlay) close(); });

  /* ---- name: click selects it all and starts typing ---- */
  const showName = () => {
    nameEl.textContent = draft.title || 'New ' + noun;
    nameEl.classList.toggle('placeholder', !draft.title);
  };
  nameEl.title = 'Click to name the ' + noun;
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
  typeBtn.addEventListener('click', () => toggleTypePicker(typeBtn, draft, typePicked));
  function typePicked(){ showType(); showOvr(); refresh(); }

  /* ---- 3f: override color — a second color that tells this event apart
     within its type. Empty ring until a color is picked on the wheel (which
     opens on a color far from the type's); the block is then drawn with a
     type → override gradient. Hover × or right-click removes it. ---- */
  const showOvr = () => {
    const o = draft.overrideColor || null;
    ovrBtn.classList.toggle('empty', !o);
    ovrBtn.style.background = o || '';
    ovrBtn.style.setProperty('--tc', o || 'transparent');
    ovrBtn.title = o ? 'Override color ' + o + '\nRight-click to remove'
                     : 'Override color — a second color to tell this ' + noun + ' apart within its type';
    ovrX.hidden = !o;
    ovrLink.classList.toggle('on', !!o);
    ovrLink.style.background = o ? 'linear-gradient(90deg, ' + typeOf(draft).color + ', ' + o + ')' : '';
  };
  const clearOvr = () => { delete draft.overrideColor; showOvr(); refresh(); };
  destroyOvrWheel = attachColorWheel(ovrBtn,
    () => draft.overrideColor || suggestOverride(typeOf(draft).color),
    hex => { draft.overrideColor = hex; showOvr(); refresh(); });
  ovrX.addEventListener('click', e => { e.stopPropagation(); clearOvr(); });
  ovrBtn.addEventListener('contextmenu', e => { e.preventDefault(); if (draft.overrideColor) clearOvr(); });

  /* ---- date ---- */
  const showDate = () => {
    if (isBlock) return;
    const d = parseIso(draft.date);
    dateLabel.textContent = DAY_NAMES[d.getDay()] + ' ' + pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear();
    /* 3e.1: this day falls in a period that cancels the event */
    const by = cancelledBy(draft, draft.date);
    cancelNote.hidden = !by;
    if (by) cancelNote.textContent = '⊘ Cancelled by ' + by.name + ' on this day' +
      (draft.recur.kind !== 'none' ? ' — repeats continue after the period' : '');
  };
  const shiftDay = n => { draft.date = isoDate(addDays(parseIso(draft.date), n)); showDate(); refresh(); };
  if (!isBlock){
    $('.ee-day-prev').addEventListener('click', () => shiftDay(-1));
    $('.ee-day-next').addEventListener('click', () => shiftDay(1));
  }

  /* ---- start / end (24-hour), or a block's duration ---- */
  const timeFields = isBlock ? [[durIn, 'duration']] : [[startIn, 'start'], [endIn, 'end']];
  function commitTime(input, key){
    let v = parseTime(input.value, key !== 'start');
    if (v && key === 'end' && v === '00:00') v = '24:00';   // ending at midnight = end of the start day
    if (!v || v === draft[key]){ input.value = draft[key]; return; }
    if (key === 'start'){
      /* moving the start keeps the duration (the end may move into the next day) */
      const dur = span(draft.start, draft.end);
      draft.start = v;
      if (dur > 0){ draft.end = endAfter(v, dur); endIn.value = draft.end; }
    } else {
      draft[key] = v;
    }
    input.value = v;
    refresh();
  }
  timeFields.forEach(([input, key]) => {
    input.value = draft[key];
    input.addEventListener('blur', () => commitTime(input, key));
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown'){
        /* ±15 min (Shift: ±1 h) */
        e.preventDefault();
        const cur = parseTime(input.value, key !== 'start') || draft[key];
        const step = (e.shiftKey ? 1 : 0.25) * (e.key === 'ArrowUp' ? 1 : -1);
        /* the end steps the duration, so it can roll past midnight into the next day */
        input.value = key === 'end'
          ? endAfter(draft.start, clamp(span(draft.start, cur) + step, 0.25, toHours(draft.start) === 0 ? 24 : 23.75))
          : fromHours(clamp(toHours(cur) + step, key === 'duration' ? 0.25 : 0, key === 'start' ? 23.75 : 24));
        commitTime(input, key);
      } else if (e.key === 'Enter'){
        e.preventDefault();
        commitTime(input, key);
        trySave();
      }
    });
  });

  /* ---- a block with no fixed duration: dropped as 1 hour, then resized on the
     calendar by dragging its top / bottom edge (the typed duration is kept, for
     when the box is unchecked) ---- */
  const flexBox = $('.ee-flex-box');
  const showFlex = () => {
    if (!isBlock) return;
    flexBox.checked = !!draft.flexible;
    durIn.disabled = !!draft.flexible;
    card.classList.toggle('flexible', !!draft.flexible);
  };
  if (isBlock) flexBox.addEventListener('change', () => {
    if (flexBox.checked) draft.flexible = true; else delete draft.flexible;
    showFlex(); refresh();
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

  /* ---- 3g: during a period — the event (and its repeats) then only happens
     on that period's days; its start day must be inside it ---- */
  const showPeriod = () => {
    if (isBlock) return;
    const p = periodOf(draft);
    periodDot.hidden = !p;
    if (p) periodDot.style.setProperty('--pc', p.color);
    periodSel.classList.toggle('tied', !!p);
  };
  if (!isBlock){
    if (draft.periodId && !periodOf(draft)) delete draft.periodId;   // its period is gone
    periodSel.appendChild(new Option('Any time', ''));
    getPeriods().forEach(p => periodSel.appendChild(new Option(p.name + '  ·  ' + shortDate(p.start) + ' – ' + shortDate(p.end), p.id)));
    periodSel.value = draft.periodId || '';
    periodSel.addEventListener('change', () => {
      if (periodSel.value) draft.periodId = periodSel.value; else delete draft.periodId;
      showPeriod(); showDate(); refresh();
    });
  }

  /* ---- save / delete ---- */
  /* an event's end may be earlier than its start: it then ends the next day */
  const badTime = () => isBlock ? !draft.flexible && toHours(draft.duration) <= 0 : span(draft.start, draft.end) <= 0;
  /* 3f: the override must be clearly different from the type color */
  const badColor = () => !!draft.overrideColor && overrideClash(draft.overrideColor, typeOf(draft).color);
  /* 3g: a tied event must start inside its period, or it would never show */
  const badPeriod = () => { const p = periodOf(draft); return !!p && (draft.date < p.start || draft.date > p.end); };
  const problem = () => !draft.title ? 'name' : badTime() ? 'time' : badColor() ? 'color' : badPeriod() ? 'period' : null;
  const timeIn = isBlock ? durIn : endIn;   // the field that is wrong when the time is
  function refresh(){
    const p = problem();
    saveBtn.setAttribute('aria-disabled', p ? 'true' : 'false');
    timeIn.classList.toggle('invalid', p === 'time');
    ovrBtn.classList.toggle('clash', p === 'color');
    if (periodSel) periodSel.classList.toggle('invalid', p === 'period');
    const nextDay = !isBlock && !p && toHours(draft.end) < toHours(draft.start);
    const flexInfo = isBlock && !p && !!draft.flexible;
    hint.classList.toggle('info', nextDay || flexInfo);
    if (p === 'time') hint.textContent = isBlock ? 'Duration must be longer than 0' : 'End can’t be the same as start';
    else if (p === 'color') hint.textContent = 'Override too close to the “' + typeOf(draft).name + '” color — pick a clearly different one';
    else if (p === 'period'){
      const per = periodOf(draft), d = parseIso(draft.date);
      hint.textContent = DAY_NAMES[d.getDay()] + ' ' + shortDate(draft.date) + ' is outside “' + per.name + '” (' + shortDate(per.start) + ' – ' + shortDate(per.end) + ')';
    }
    else if (nextDay){
      const d = addDays(parseIso(draft.date), 1);
      hint.textContent = 'Ends next day, ' + DAY_NAMES[d.getDay()] + ' ' + pad(d.getDate()) + '.' + pad(d.getMonth() + 1);
    } else if (flexInfo) hint.textContent = 'Lands as 1 hour — drag its edges on the calendar';
    else hint.textContent = '';
  }
  function trySave(){
    timeFields.forEach(([input, key]) => commitTime(input, key));
    const p = problem();
    if (p === 'name'){ pulse(nameEl); return; }
    if (p === 'time'){ pulse(timeIn); return; }
    if (p === 'color'){ pulse(ovrBtn); return; }
    if (p === 'period'){ pulse(periodSel); return; }
    rememberType(draft.typeId);
    (isBlock ? saveBlock : saveEvent)(draft);
    close();
  }
  saveBtn.textContent = editing ? 'Save' : 'Create';
  saveBtn.addEventListener('click', trySave);
  card.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)){ e.preventDefault(); trySave(); } });

  if (editing){
    delBtn.textContent = isBlock ? 'delete block'
      : draft.recur.kind !== 'none' ? 'delete event (all repeats)' : 'delete event';
    delBtn.addEventListener('click', () => {
      (isBlock ? deleteBlock : deleteEvent)(draft.id);
      close();
      toast('Deleted “' + draft.title + '”');
    });
  } else {
    delBtn.hidden = true;
  }

  showName(); showType(); showOvr(); showDate(); showRecur(); showPeriod(); showFlex(); refresh();
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
      add.addEventListener('click', () => render({ name: '', color: themeColor('--accent-bright') }));
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
