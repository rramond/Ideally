import { openPopup, closePopup } from './lib/history.js';
import { addCloseX } from './lib/popups.js';
import { toast } from './lib/toast.js';
import { isoDate } from './lib/dates.js';
import { allFileRecords, clearFiles, putFile } from './projects/fileStore.js';

/* ============================================================
   EXPORT / IMPORT (GENERAL d) — move everything to another
   browser or device. Export saves one .json file: every saved
   value (the ideally.* keys: projects, notes, events, time blocks,
   types, periods, reminders, stickies, settings…) and every file attached
   to a project (from IndexedDB, as data URLs). Import reads such
   a file and either
   - merges it: items this device doesn't have yet (by id) are
     added — projects, notes, events, blocks, types, periods, reminders,
     stickies, arrows, attached files; what's here already, and
     this device's settings, are kept
   - or replaces this device's data with it entirely.
   The page reloads afterwards.
============================================================ */
const PREFIX = 'ideally.';
/* the lists merged by id, with how to name them in the toast */
const LIST_NAMES = {
  projects: ['project', 'projects'], notes: ['note', 'notes'], events: ['event', 'events'],
  timeBlocks: ['time block', 'time blocks'], eventTypes: ['event type', 'event types'], periods: ['period', 'periods'], reminders: ['reminder', 'reminders'],
  stickies: ['vision board sticky', 'vision board stickies'], arrows: ['vision board arrow', 'vision board arrows']
};
const LISTS = Object.keys(LIST_NAMES).map(k => PREFIX + k);
const DERIVED = [PREFIX + 'dayLabels', PREFIX + 'periodColors'];   // rebuilt from the periods on load
const DIALOG = 'import-dialog';

const el = (tag, cls, text) => {
  const x = document.createElement(tag);
  if (cls) x.className = cls;
  if (text != null) x.textContent = text;
  return x;
};
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
const ownKeys = () => Object.keys(localStorage).filter(k => k.startsWith(PREFIX));
const parse = raw => { try { return JSON.parse(raw); } catch { return null; } };

const blobToDataUrl = blob => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = () => rej(r.error);
  r.readAsDataURL(blob);
});
const dataUrlToBlob = url => fetch(url).then(r => r.blob());

/* "3 projects · 42 events · 5 time blocks · 4 files" */
function summary(storage, fileCount){
  const n = k => { const v = parse(storage[PREFIX + k]); return Array.isArray(v) ? v.length : 0; };
  return [plural(n('projects'), 'project'), plural(n('notes'), 'note'), plural(n('events'), 'event'),
          plural(n('timeBlocks'), 'time block'), plural(n('periods'), 'period'), plural(n('reminders'), 'reminder'), plural(fileCount, 'file')].join(' · ');
}

/* ---------------- export ---------------- */
export async function exportData(){
  try {
    const storage = {};
    ownKeys().forEach(k => { storage[k] = localStorage.getItem(k); });
    let files = [];
    try {
      const recs = await allFileRecords();
      files = await Promise.all(recs.map(async r => ({ id: r.id, projectId: r.projectId, type: r.blob.type, data: await blobToDataUrl(r.blob) })));
    } catch { toast('Attached files couldn’t be read — exporting the rest'); }
    const backup = { app: 'ideally', version: 1, exported: new Date().toISOString(), storage, files };
    const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a');
    a.href = url;
    a.download = 'ideally-backup-' + isoDate(new Date()) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast('Exported ' + summary(storage, files.length));
  } catch (err){
    toast('Export failed: ' + (err && err.message || err));
  }
}

/* ---------------- import ---------------- */
export function importData(){
  const input = el('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    const backup = parse(await file.text());
    if (!backup || backup.app !== 'ideally' || typeof backup.storage !== 'object'){
      toast('That file isn’t an Ideally export');
      return;
    }
    showDialog(backup, file.name);
  });
  input.click();
}

async function showDialog(backup, fileName){
  closePopup(DIALOG);
  const here = {};
  ownKeys().forEach(k => { here[k] = localStorage.getItem(k); });
  let hereFiles = 0;
  try { hereFiles = (await allFileRecords()).length; } catch {}
  const files = Array.isArray(backup.files) ? backup.files : [];

  const overlay = el('div', 'ev-overlay');
  const card = el('div', 'ev-card bk-card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-label', 'Import data');
  const when = backup.exported ? new Date(backup.exported).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '?';
  const rows = el('div', 'bk-rows');
  const row = (label, text) => { const r = el('div', 'bk-row'); r.append(el('span', 'bk-label', label), el('span', 'bk-text', text)); rows.appendChild(r); };
  row('File', fileName + ' — exported ' + when);
  row('In the file', summary(backup.storage, files.length));
  row('On this device', summary(here, hereFiles));
  const note = el('p', 'bk-note',
    'Merge adds what this device doesn’t have yet and keeps everything here. ' +
    'Replace deletes this device’s data and uses the file’s instead.');
  const foot = el('div', 'ee-foot');
  const cancel = el('button', 'ghost-btn', 'Cancel');
  const replace = el('button', 'ghost-btn bk-replace', 'Replace');
  const merge = el('button', 'primary-btn', 'Merge');
  [cancel, replace, merge].forEach(b => { b.type = 'button'; });
  foot.append(el('span', 'ee-hint info'), cancel, replace, merge);
  card.append(el('h2', 'ee-name', 'Import data'), rows, note, foot);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const close = () => closePopup(DIALOG);
  openPopup(DIALOG, () => overlay.remove());
  addCloseX(card, close);
  overlay.addEventListener('pointerdown', e => { if (e.target === overlay) close(); });
  cancel.addEventListener('click', close);

  const busy = text => { [cancel, replace, merge].forEach(b => { b.disabled = true; }); foot.querySelector('.ee-hint').textContent = text; };
  merge.addEventListener('click', async () => {
    busy('Merging…');
    const added = await mergeIn(backup);
    toast('Merged: ' + (added || 'nothing new to add'));
    setTimeout(() => location.reload(), 700);
  });
  let armed = false;
  replace.addEventListener('click', async () => {
    if (!armed){                       // a second click confirms
      armed = true;
      replace.textContent = 'Click again to replace';
      replace.classList.add('armed');
      return;
    }
    busy('Replacing…');
    await replaceWith(backup);
    toast('Replaced this device’s data with the file');
    setTimeout(() => location.reload(), 700);
  });
  merge.focus();
}

async function writeFiles(list, skip = new Set()){
  let n = 0;
  for (const f of list){
    if (!f || !f.id || !f.data || skip.has(f.id)) continue;
    try { await putFile(f.id, f.projectId, await dataUrlToBlob(f.data)); n++; } catch {}
  }
  return n;
}

async function replaceWith(backup){
  ownKeys().forEach(k => localStorage.removeItem(k));
  Object.entries(backup.storage).forEach(([k, v]) => {
    if (k.startsWith(PREFIX) && !DERIVED.includes(k) && typeof v === 'string') localStorage.setItem(k, v);
  });
  try { await clearFiles(); await writeFiles(backup.files || []); } catch { toast('Attached files couldn’t be written'); }
}

/* lists: add the items whose id isn't here yet; other values: only if this device has none */
async function mergeIn(backup){
  const counts = [];
  Object.entries(backup.storage).forEach(([k, v]) => {
    if (!k.startsWith(PREFIX) || DERIVED.includes(k) || typeof v !== 'string') return;
    const mine = localStorage.getItem(k);
    if (LISTS.includes(k)){
      const theirs = parse(v), ours = parse(mine) || [];
      if (!Array.isArray(theirs) || !Array.isArray(ours)) return;
      const have = new Set(ours.map(x => x && x.id));
      const extra = theirs.filter(x => x && x.id && !have.has(x.id));
      if (extra.length){
        localStorage.setItem(k, JSON.stringify(ours.concat(extra)));
        const [one, many] = LIST_NAMES[k.slice(PREFIX.length)];
        counts.push(extra.length + ' ' + (extra.length === 1 ? one : many));
      }
    } else if (mine == null){
      localStorage.setItem(k, v);
    }
  });
  try {
    const have = new Set((await allFileRecords()).map(r => r.id));
    const n = await writeFiles(backup.files || [], have);
    if (n) counts.push(plural(n, 'file'));
  } catch {}
  return counts.join(', ');
}
