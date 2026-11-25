import { uid } from '../lib/utils.js';
import { isoDate, addDays, parseIso, mondayOf } from '../lib/dates.js';
import { openPopup, closePopup, isPopupOpen } from '../lib/history.js';
import { addCloseX } from '../lib/popups.js';
import { toast } from '../lib/toast.js';
import { fmtDate, parseDateInput } from './periodEditor.js';
import { saveReminder, deleteReminder, remindersOn } from './reminders.js';
import { PICTOGRAMS, pictogramNode } from './pictograms.js';

/* ============================================================
   REMINDER OVERLAY — name, date (typed DD.MM.YYYY, ↑/↓ ±1 day,
   or a mini month picker), description, and the pictogram:
   a dropdown grid of emojis, the default red "!!" first, and a
   field to paste any other emoji
============================================================ */
const EDITOR = 'reminder-editor', PICKER = 'reminder-date-picker', ICONS = 'reminder-icons';
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const el = (tag, cls, text) => {
  const x = document.createElement(tag);
  if (cls) x.className = cls;
  if (text != null) x.textContent = text;
  return x;
};
const pulse = node => { node.classList.remove('pulse'); void node.offsetWidth; node.classList.add('pulse'); };

const TEMPLATE =
  '<div class="ee-head">' +
    '<h2 class="ee-name" title="Click to name the reminder"></h2>' +
    '<div class="rem-icon-wrap"><button class="rem-icon-btn" type="button" title="Pictogram"></button></div>' +
  '</div>' +
  '<div class="pe-dates rem-dates">' +
    '<label class="ee-field"><span>Date</span><input class="pe-date rem-date" maxlength="10" autocomplete="off" spellcheck="false"></label>' +
    '<span class="pe-days rem-weekday"></span>' +
  '</div>' +
  '<label class="ee-field"><span>Description</span><textarea class="ee-desc rem-desc" rows="3" placeholder="Add details…"></textarea></label>' +
  '<div class="ee-foot">' +
    '<button class="danger-link ee-delete" type="button"></button>' +
    '<span class="ee-hint"></span>' +
    '<button class="primary-btn ee-save" type="button"></button>' +
  '</div>';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* new reminder ({ date }) or an existing one ({ reminder }) */
export function openReminderEditor({ reminder = null, date } = {}){
  closePopup(EDITOR);
  const editing = !!reminder;
  const today = isoDate(new Date());
  const draft = editing
    ? { ...reminder }
    : { id: uid(), name: '', date: date || today, description: '', icon: null };

  const overlay = el('div', 'ev-overlay');
  const card = el('div', 'ev-card rem-card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-label', editing ? 'Edit reminder' : 'New reminder');
  card.innerHTML = TEMPLATE;
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const $ = sel => card.querySelector(sel);
  const nameEl = $('.ee-name'), iconBtn = $('.rem-icon-btn'), iconWrap = $('.rem-icon-wrap');
  const datesRow = $('.rem-dates'), dateIn = $('.rem-date'), weekdayEl = $('.rem-weekday'), descIn = $('.rem-desc');
  const delBtn = $('.ee-delete'), hint = $('.ee-hint'), saveBtn = $('.ee-save');

  const close = () => closePopup(EDITOR);
  openPopup(EDITOR, () => overlay.remove());
  addCloseX(card, close);
  overlay.addEventListener('pointerdown', e => { if (e.target === overlay) close(); });

  /* ---- name: click selects it all and starts typing ---- */
  const showName = () => {
    nameEl.textContent = draft.name || 'New reminder';
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

  /* ---- pictogram: the button shows the current one; it opens the grid ---- */
  const showIcon = () => {
    iconBtn.innerHTML = '';
    iconBtn.appendChild(pictogramNode(draft.icon, 'pg rem-sticker-look'));
  };
  iconBtn.addEventListener('click', () => isPopupOpen(ICONS) ? closePopup(ICONS) : openIconGrid());
  function openIconGrid(){
    const pop = el('div', 'rem-icon-pop');
    const grid = el('div', 'rem-icon-grid');
    const choose = icon => { draft.icon = icon; showIcon(); closePopup(ICONS); };
    [null, ...PICTOGRAMS].forEach(icon => {
      const b = el('button', 'rem-icon-opt' + ((draft.icon || null) === icon ? ' on' : ''));
      b.type = 'button';
      b.title = icon ? icon : 'Default (!!)';
      b.appendChild(pictogramNode(icon));
      b.addEventListener('click', () => choose(icon));
      grid.appendChild(b);
    });
    /* any other emoji: typed or pasted (the first character cluster is kept) */
    const custom = el('input', 'rem-icon-custom');
    custom.placeholder = 'or paste any emoji…';
    custom.maxLength = 16;
    custom.autocomplete = 'off';
    const takeCustom = () => {
      const v = custom.value.trim();
      if (!v) return;
      const first = typeof Intl !== 'undefined' && Intl.Segmenter
        ? [...new Intl.Segmenter().segment(v)][0].segment : [...v][0];
      choose(first);
    };
    custom.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); e.stopPropagation(); takeCustom(); } });
    pop.append(grid, custom);
    iconWrap.appendChild(pop);
    const onDown = e => { if (!pop.contains(e.target) && !iconBtn.contains(e.target)) closePopup(ICONS); };
    openPopup(ICONS, () => { pop.remove(); document.removeEventListener('pointerdown', onDown); });
    document.addEventListener('pointerdown', onDown);
  }

  /* ---- date: typed, ↑/↓ ±1 day, or the mini month picker ---- */
  const showDate = () => {
    dateIn.value = fmtDate(draft.date);
    const d = parseIso(draft.date);
    weekdayEl.textContent = WEEKDAYS[d.getDay()] + (draft.date === today ? ' · today' : '');
  };
  function commitDate(){
    const v = parseDateInput(dateIn.value, Number(draft.date.slice(0, 4)));
    if (v) draft.date = v;
    showDate();
  }
  dateIn.addEventListener('click', openDatePicker);
  dateIn.addEventListener('blur', commitDate);
  dateIn.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown'){
      e.preventDefault();
      commitDate();
      draft.date = isoDate(addDays(parseIso(draft.date), e.key === 'ArrowUp' ? 1 : -1));
      showDate();
      if (pickerRender) pickerRender();
    } else if (e.key === 'Enter'){
      e.preventDefault();
      commitDate();
      trySave();
    }
  });

  /* mini month picker: one click picks the day; dots mark days that already have reminders */
  let month = null, pickerRender = null;
  function openDatePicker(){
    if (isPopupOpen(PICKER)) return;
    const m = parseIso(draft.date);
    month = new Date(m.getFullYear(), m.getMonth(), 1);
    const pop = el('div', 'pe-picker');
    datesRow.appendChild(pop);
    pop.addEventListener('mousedown', e => e.preventDefault());   // keep the typed field focused
    const onDown = e => { if (!pop.contains(e.target) && e.target !== dateIn) closePopup(PICKER); };
    openPopup(PICKER, () => {
      pop.remove();
      pickerRender = null;
      dateIn.classList.remove('picking');
      document.removeEventListener('pointerdown', onDown);
    });
    document.addEventListener('pointerdown', onDown);
    dateIn.classList.add('picking');

    pickerRender = function render(){
      pop.innerHTML = '';
      addCloseX(pop, () => closePopup(PICKER));
      const head = el('div', 'pp-head');
      const prev = el('button', 'icon-btn pp-nav', '‹');
      const next = el('button', 'icon-btn pp-nav', '›');
      prev.type = next.type = 'button';
      prev.title = 'Previous month'; next.title = 'Next month';
      prev.addEventListener('click', () => { month = new Date(month.getFullYear(), month.getMonth() - 1, 1); render(); });
      next.addEventListener('click', () => { month = new Date(month.getFullYear(), month.getMonth() + 1, 1); render(); });
      head.append(prev, el('span', 'pp-title', MONTHS[month.getMonth()] + ' ' + month.getFullYear()), next);
      pop.appendChild(head);

      const grid = el('div', 'pp-grid');
      ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach(d => grid.appendChild(el('span', 'pp-dow', d)));
      const first = mondayOf(month);
      for (let i = 0; i < 42; i++){
        const d = addDays(first, i);
        const iso = isoDate(d);
        const b = el('button', 'pp-day', String(d.getDate()));
        b.type = 'button';
        if (d.getMonth() !== month.getMonth()) b.classList.add('other');
        if (iso === today) b.classList.add('today');
        if (iso === draft.date) b.classList.add('range-start', 'range-end');
        const others = remindersOn(iso).filter(r => r.id !== draft.id);
        if (others.length){
          const dots = el('span', 'pp-dots');
          others.slice(0, 3).forEach(() => dots.appendChild(el('i', 'rem-dot')));
          b.appendChild(dots);
          b.title = others.map(r => r.name).join(', ');
        }
        b.addEventListener('click', () => { draft.date = iso; showDate(); closePopup(PICKER); });
        grid.appendChild(b);
      }
      pop.appendChild(grid);
    };
    pickerRender();
  }

  /* ---- description ---- */
  descIn.value = draft.description || '';
  descIn.addEventListener('input', () => { draft.description = descIn.value; });

  /* ---- save / delete ---- */
  function refresh(){
    saveBtn.setAttribute('aria-disabled', draft.name ? 'false' : 'true');
  }
  function trySave(){
    commitDate();
    if (!draft.name){ pulse(nameEl); return; }
    saveReminder({ ...draft, description: draft.description.trim() });
    close();
    if (!editing) toast('Reminder “' + draft.name + '” on ' + fmtDate(draft.date).slice(0, 5));
  }
  saveBtn.textContent = editing ? 'Save' : 'Create';
  saveBtn.addEventListener('click', trySave);
  card.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)){ e.preventDefault(); trySave(); } });

  if (editing){
    delBtn.textContent = 'delete reminder';
    delBtn.addEventListener('click', () => {
      deleteReminder(draft.id);
      close();
      toast('Deleted reminder “' + draft.name + '”');
    });
  } else {
    delBtn.hidden = true;
  }

  showName(); showIcon(); showDate(); refresh();
  /* a new reminder starts with its name being typed */
  if (!editing) nameEl.click();
}
