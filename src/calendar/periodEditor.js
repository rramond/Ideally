import { uid } from '../lib/utils.js';
import { pad, isoDate, addDays, parseIso, mondayOf, daysInMonth } from '../lib/dates.js';
import { openPopup, closePopup, isPopupOpen } from '../lib/history.js';
import { addCloseX } from '../lib/popups.js';
import { toast } from '../lib/toast.js';
import { attachColorWheel } from '../colorWheel.js';
import { periodsOn, nameTaken, colorClash, suggestColor, savePeriod, deletePeriod, dayCount } from './periods.js';

/* ============================================================
   PERIOD OVERLAY (3e) — name (= the period's label), color
   (must be clearly different from other periods'), and a
   start → end date range picked on a mini month calendar
============================================================ */
const EDITOR = 'period-editor', PICKER = 'period-date-picker';
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const el = (tag, cls, text) => {
  const x = document.createElement(tag);
  if (cls) x.className = cls;
  if (text != null) x.textContent = text;
  return x;
};
const pulse = node => { node.classList.remove('pulse'); void node.offsetWidth; node.classList.add('pulse'); };
const fmtDate = iso => { const [y, m, d] = iso.split('-'); return d + '.' + m + '.' + y; };

/* "1611" / "16.11" → 16.11.<year>, "16.11.27" / "16.11.2027" / "16112027" → 'YYYY-MM-DD' (or null) */
function parseDateInput(str, year){
  const s = str.trim();
  let d, m, y;
  const parts = s.split(/[.\/\-\s]+/).filter(Boolean);
  if (parts.length >= 2) [d, m, y] = parts.map(Number);
  else if (/^\d{4}$/.test(s)){ d = +s.slice(0, 2); m = +s.slice(2); }
  else if (/^\d{6}$|^\d{8}$/.test(s)){ d = +s.slice(0, 2); m = +s.slice(2, 4); y = +s.slice(4); }
  else return null;
  if (y == null || Number.isNaN(y)) y = year;
  else if (y < 100) y += 2000;
  if (!(m >= 1 && m <= 12) || !(d >= 1 && d <= daysInMonth(y, m - 1))) return null;
  return y + '-' + pad(m) + '-' + pad(d);
}

const TEMPLATE =
  '<div class="ee-head">' +
    '<h2 class="ee-name" title="Click to name the period"></h2>' +
    '<div class="ee-type-wrap pe-color-wrap"><button class="ee-type pe-color" type="button" title="Period color"></button></div>' +
  '</div>' +
  '<div class="pe-dates">' +
    '<label class="ee-field"><span>Start</span><input class="pe-date pe-start" maxlength="10" autocomplete="off" spellcheck="false"></label>' +
    '<span class="pe-arrow">→</span>' +
    '<label class="ee-field"><span>End</span><input class="pe-date pe-end" maxlength="10" autocomplete="off" spellcheck="false"></label>' +
    '<span class="pe-days"></span>' +
  '</div>' +
  '<p class="pe-note">Only the color shows on the calendar — hover a day to see the name.</p>' +
  '<div class="ee-foot">' +
    '<button class="danger-link ee-delete" type="button"></button>' +
    '<span class="ee-hint"></span>' +
    '<button class="primary-btn ee-save" type="button"></button>' +
  '</div>';

/* new period ({ start, end }, pickEnd: open the picker waiting for the end date)
   or an existing one ({ period }) */
export function openPeriodEditor({ period = null, start, end, pickEnd = false } = {}){
  closePopup(EDITOR);
  const editing = !!period;
  const today = isoDate(new Date());
  const draft = editing
    ? { ...period }
    : { id: uid(), name: '', color: suggestColor(), start: start || today, end: end || start || today };

  const overlay = el('div', 'ev-overlay');
  const card = el('div', 'ev-card pe-card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-label', editing ? 'Edit period' : 'New period');
  card.innerHTML = TEMPLATE;
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const $ = sel => card.querySelector(sel);
  const nameEl = $('.ee-name'), colorBtn = $('.pe-color');
  const datesRow = $('.pe-dates'), startIn = $('.pe-start'), endIn = $('.pe-end'), daysEl = $('.pe-days');
  const delBtn = $('.ee-delete'), hint = $('.ee-hint'), saveBtn = $('.ee-save');

  const close = () => closePopup(EDITOR);
  let destroyWheel = null;
  openPopup(EDITOR, () => { if (destroyWheel) destroyWheel(); overlay.remove(); });
  addCloseX(card, close);
  overlay.addEventListener('pointerdown', e => { if (e.target === overlay) close(); });

  /* ---- name: click selects it all and starts typing; it is the period's label ---- */
  const showName = () => {
    nameEl.textContent = draft.name || 'New period';
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

  /* ---- color (color wheel; must be clearly different from other periods) ---- */
  const showColor = () => {
    colorBtn.style.background = draft.color;
    colorBtn.style.setProperty('--tc', draft.color);
    card.style.setProperty('--pc', draft.color);
  };
  destroyWheel = attachColorWheel(colorBtn, () => draft.color, hex => { draft.color = hex; showColor(); refresh(); });

  /* ---- dates: typed DD.MM.YYYY, ↑/↓ ±1 day, or the mini month picker ---- */
  const showDates = () => {
    startIn.value = fmtDate(draft.start);
    endIn.value = fmtDate(draft.end);
    const n = dayCount(draft);
    daysEl.textContent = n + (n === 1 ? ' day' : ' days');
  };
  function setRange(a, b){
    [draft.start, draft.end] = a <= b ? [a, b] : [b, a];
    showDates();
  }
  function commitDate(input, key){
    const v = parseDateInput(input.value, Number(draft[key].slice(0, 4)));
    if (!v){ input.value = fmtDate(draft[key]); return; }
    if (key === 'start') setRange(v, draft.end); else setRange(draft.start, v);
  }
  [[startIn, 'start'], [endIn, 'end']].forEach(([input, key]) => {
    input.addEventListener('click', () => openDatePicker(key));
    input.addEventListener('blur', () => commitDate(input, key));
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown'){
        e.preventDefault();
        commitDate(input, key);
        const moved = isoDate(addDays(parseIso(draft[key]), e.key === 'ArrowUp' ? 1 : -1));
        if (key === 'start') setRange(moved, draft.end < moved ? moved : draft.end);
        else setRange(draft.start > moved ? moved : draft.start, moved);
        if (pickerRender) pickerRender();
      } else if (e.key === 'Enter'){
        e.preventDefault();
        commitDate(input, key);
        trySave();
      }
    });
  });

  /* mini month picker: click the start, then the end (range in the period's color);
     dots mark days that already belong to other periods */
  let pick = null;            // { awaiting: 'start' | 'end', month, hover } while open
  let pickerRender = null;
  function openDatePicker(awaiting){
    if (isPopupOpen(PICKER)){ pick.awaiting = awaiting; pick.hover = null; pickerRender(); return; }
    const m = parseIso(draft[awaiting]);
    pick = { awaiting, month: new Date(m.getFullYear(), m.getMonth(), 1), hover: null };
    const pop = el('div', 'pe-picker');
    datesRow.appendChild(pop);
    pop.addEventListener('mousedown', e => e.preventDefault());   // keep the typed field focused
    const onDown = e => {
      if (!pop.contains(e.target) && e.target !== startIn && e.target !== endIn && !e.target.closest('[data-back]')) closePopup(PICKER);
    };
    openPopup(PICKER, () => {
      pop.remove();
      pickerRender = null;
      pick = null;
      startIn.classList.remove('picking');
      endIn.classList.remove('picking');
      document.removeEventListener('pointerdown', onDown);
    });
    document.addEventListener('pointerdown', onDown);

    /* render() builds the month; paint() only updates the range highlight,
       so hovering never replaces the button under the cursor */
    let days = [], hintEl = null;
    function paint(){
      let [lo, hi] = [draft.start, draft.end];
      /* while waiting for the end date, hovering previews the range */
      if (pick.awaiting === 'end' && pick.hover) [lo, hi] = draft.start <= pick.hover ? [draft.start, pick.hover] : [pick.hover, draft.start];
      days.forEach(({ b, iso }) => {
        b.classList.toggle('in-range', lo <= iso && iso <= hi);
        b.classList.toggle('range-start', iso === lo);
        b.classList.toggle('range-end', iso === hi);
      });
      hintEl.textContent = pick.awaiting === 'start' ? 'Pick the first day' : 'Pick the last day';
      startIn.classList.toggle('picking', pick.awaiting === 'start');
      endIn.classList.toggle('picking', pick.awaiting === 'end');
    }
    pickerRender = function render(){
      pop.innerHTML = '';
      addCloseX(pop, () => closePopup(PICKER));
      const head = el('div', 'pp-head');
      const prev = el('button', 'icon-btn pp-nav', '‹');
      const next = el('button', 'icon-btn pp-nav', '›');
      prev.type = next.type = 'button';
      prev.title = 'Previous month'; next.title = 'Next month';
      prev.addEventListener('click', () => { pick.month = new Date(pick.month.getFullYear(), pick.month.getMonth() - 1, 1); render(); });
      next.addEventListener('click', () => { pick.month = new Date(pick.month.getFullYear(), pick.month.getMonth() + 1, 1); render(); });
      head.append(prev, el('span', 'pp-title', MONTHS[pick.month.getMonth()] + ' ' + pick.month.getFullYear()), next);
      pop.appendChild(head);

      const grid = el('div', 'pp-grid');
      ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach(d => grid.appendChild(el('span', 'pp-dow', d)));
      days = [];
      const first = mondayOf(pick.month);
      for (let i = 0; i < 42; i++){
        const d = addDays(first, i);
        const iso = isoDate(d);
        const b = el('button', 'pp-day', String(d.getDate()));
        b.type = 'button';
        if (d.getMonth() !== pick.month.getMonth()) b.classList.add('other');
        if (iso === today) b.classList.add('today');
        const others = periodsOn(iso).filter(p => p.id !== draft.id);
        if (others.length){
          const dots = el('span', 'pp-dots');
          others.slice(0, 3).forEach(p => { const dot = el('i'); dot.style.background = p.color; dots.appendChild(dot); });
          b.appendChild(dots);
          b.title = others.map(p => p.name).join(', ');
        }
        b.addEventListener('mouseenter', () => { if (pick.awaiting === 'end'){ pick.hover = iso; paint(); } });
        b.addEventListener('click', () => {
          if (pick.awaiting === 'start'){
            setRange(iso, iso);
            pick.awaiting = 'end';
            pick.hover = null;
            paint();
          } else {
            setRange(draft.start, iso);
            closePopup(PICKER);
          }
        });
        days.push({ b, iso });
        grid.appendChild(b);
      }
      pop.appendChild(grid);
      hintEl = el('p', 'pp-hint');
      pop.appendChild(hintEl);
      paint();
    };
    pickerRender();
  }

  /* ---- save / delete ---- */
  function problem(){
    if (!draft.name) return { kind: 'name', text: '' };
    const taken = nameTaken(draft.name, draft.id);
    if (taken) return { kind: 'name', text: 'Another period is already called “' + taken.name + '”' };
    const clash = colorClash(draft.color, draft.id);
    if (clash) return { kind: 'color', text: 'Color too close to “' + clash.name + '” — pick a clearly different one' };
    return null;
  }
  function refresh(){
    const p = problem();
    saveBtn.setAttribute('aria-disabled', p ? 'true' : 'false');
    hint.textContent = p ? p.text : '';
    colorBtn.classList.toggle('clash', !!p && p.kind === 'color');
  }
  function trySave(){
    commitDate(startIn, 'start');
    commitDate(endIn, 'end');
    const p = problem();
    if (p){ pulse(p.kind === 'color' ? colorBtn : nameEl); return; }
    savePeriod({ ...draft });
    close();
  }
  saveBtn.textContent = editing ? 'Save' : 'Create';
  saveBtn.addEventListener('click', trySave);
  card.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)){ e.preventDefault(); trySave(); } });

  if (editing){
    delBtn.textContent = 'delete period';
    delBtn.addEventListener('click', () => {
      deletePeriod(draft.id);
      close();
      toast('Deleted period “' + draft.name + '”');
    });
  } else {
    delBtn.hidden = true;
  }

  showName(); showColor(); showDates(); refresh();
  if (pickEnd) openDatePicker('end');
}
