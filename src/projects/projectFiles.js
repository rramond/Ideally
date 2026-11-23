import { uid } from '../lib/utils.js';
import { showContextMenu } from '../lib/contextMenu.js';
import { openPopup, closePopup } from '../lib/history.js';
import { addCloseX } from '../lib/popups.js';
import { toast } from '../lib/toast.js';
import { getProject, updateProject } from './projects.js';
import { putFile, getFileBlob, deleteFiles } from './fileStore.js';

/* ============================================================
   PROJECT FILES (2e) — attach files to a project: drop them
   anywhere on the project page, paste them (Ctrl+V), or "Add
   files". A grid of cards, images with a thumbnail. Click opens
   (images in a preview, PDFs / text / media in a new tab, the
   rest downloads); right-click: Open / Download / Rename / Delete.
   The contents live in IndexedDB (fileStore.js).
============================================================ */
const MAX_SIZE = 200 * 1024 * 1024;   // per file
const PREVIEW = 'file-preview';

const el = (tag, cls, text) => {
  const x = document.createElement(tag);
  if (cls) x.className = cls;
  if (text != null) x.textContent = text;
  return x;
};
export function sizeLabel(b){
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(b < 10240 ? 1 : 0) + ' KB';
  if (b < 1024 ** 3) return (b / 1024 / 1024).toFixed(b < 10 * 1024 * 1024 ? 1 : 0) + ' MB';
  return (b / 1024 ** 3).toFixed(1) + ' GB';
}
const extOf = name => { const m = /\.([a-z0-9]{1,5})$/i.exec(name); return m ? m[1].toUpperCase() : 'FILE'; };
const isImage = f => /^image\//.test(f.type);
const opensInTab = f => /^(application\/pdf|text\/|video\/|audio\/)/.test(f.type) || isImage(f);
const fmtDate = ts => new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

/* a color per kind of file, for the badge */
function kindColor(f){
  if (isImage(f)) return '#34D399';
  if (/pdf/.test(f.type)) return '#F87171';
  if (/^video\//.test(f.type)) return '#F472B6';
  if (/^audio\//.test(f.type)) return '#FBBF24';
  if (/^text\/|json|javascript|xml/.test(f.type)) return '#60A5FA';
  if (/zip|compressed|tar|rar|7z/.test(f.type)) return '#A78BFA';
  if (/sheet|excel|csv/.test(f.type)) return '#4ADE80';
  if (/word|document|presentation|powerpoint/.test(f.type)) return '#38BDF8';
  return '#94A3B8';
}

/* add File objects to a project; resolves to how many were added */
export async function addFiles(projectId, fileList){
  const files = [...fileList];
  const tooBig = files.filter(f => f.size > MAX_SIZE);
  const ok = files.filter(f => f.size <= MAX_SIZE);
  if (tooBig.length) toast((tooBig.length === 1 ? '“' + tooBig[0].name + '” is' : tooBig.length + ' files are') + ' over ' + sizeLabel(MAX_SIZE) + ' — not added');
  let added = 0;
  for (const f of ok){
    const meta = { id: uid(), name: f.name || 'pasted.' + (f.type.split('/')[1] || 'bin'), size: f.size, type: f.type || '', added: Date.now() };
    try {
      await putFile(meta.id, projectId, f);
      updateProject(projectId, p => { p.files.unshift(meta); });
      added++;
    } catch (err){
      toast('Couldn\'t store “' + meta.name + '” (' + (err && err.message || 'storage error') + ')');
      break;
    }
  }
  if (added) toast('Added ' + (added === 1 ? '“' + ok[0].name + '”' : added + ' files'));
  return added;
}

export function mountFiles(root, projectId){
  const head = el('div', 'pj-sec-head');
  const total = el('span', 'fl-total');
  const addBtn = el('button', 'ghost-btn pj-small-btn', '+ Add files');
  addBtn.type = 'button';
  const input = el('input');
  input.type = 'file'; input.multiple = true; input.hidden = true;
  head.append(el('span', 'nav-label', 'Files'), total, el('span', 'pj-grow'), addBtn, input);
  const grid = el('div', 'fl-grid');
  root.append(head, grid);

  const urls = new Map();     // file id → object URL (thumbnails), revoked on teardown
  const files = () => (getProject(projectId) || {}).files || [];

  function render(){
    grid.innerHTML = '';
    const fs = files();
    total.textContent = fs.length ? fs.length + (fs.length === 1 ? ' file · ' : ' files · ') + sizeLabel(fs.reduce((s, f) => s + f.size, 0)) : '';
    if (!fs.length){
      const empty = el('div', 'fl-empty');
      empty.append(el('div', 'fl-empty-icon', '⇪'), el('p', null, 'Drop files anywhere on this project, paste them, or'));
      const b = el('button', 'ghost-btn', 'Choose files');
      b.type = 'button';
      b.addEventListener('click', () => input.click());
      empty.appendChild(b);
      grid.appendChild(empty);
      return;
    }
    fs.forEach(f => {
      const card = el('button', 'fl-card');
      card.type = 'button';
      card.dataset.id = f.id;
      card.title = f.name + '\n' + sizeLabel(f.size) + ' · added ' + fmtDate(f.added) + '\nClick to open · right-click for more';
      const thumb = el('div', 'fl-thumb');
      thumb.style.setProperty('--kc', kindColor(f));
      if (isImage(f)){
        const img = el('img');
        img.alt = '';
        img.loading = 'lazy';
        thumb.appendChild(img);
        loadThumb(f, img);
      } else thumb.appendChild(el('span', 'fl-ext', extOf(f.name)));
      const name = el('span', 'fl-name', f.name);
      card.append(thumb, name, el('span', 'fl-meta', sizeLabel(f.size) + ' · ' + fmtDate(f.added)));
      grid.appendChild(card);
    });
  }
  async function loadThumb(f, img){
    try {
      if (!urls.has(f.id)){
        const blob = await getFileBlob(f.id);
        if (!blob){ img.replaceWith(el('span', 'fl-ext missing', 'missing')); return; }
        urls.set(f.id, URL.createObjectURL(blob));
      }
      img.src = urls.get(f.id);
    } catch { img.replaceWith(el('span', 'fl-ext', extOf(f.name))); }
  }

  async function blobOf(f){
    const blob = await getFileBlob(f.id).catch(() => null);
    if (!blob) toast('“' + f.name + '” isn\'t stored in this browser anymore');
    return blob;
  }
  async function open(f){
    const blob = await blobOf(f);
    if (!blob) return;
    if (isImage(f)) return preview(f, blob);
    if (!opensInTab(f)) return download(f, blob);
    const url = URL.createObjectURL(new Blob([blob], { type: f.type }));
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async function download(f, blob){
    blob ||= await blobOf(f);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = el('a');
    a.href = url; a.download = f.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  function preview(f, blob){
    closePopup(PREVIEW);
    const url = URL.createObjectURL(blob);
    const overlay = el('div', 'ev-overlay fl-preview');
    const card = el('figure', 'fl-preview-card');
    const img = el('img');
    img.src = url; img.alt = f.name;
    const cap = el('figcaption');
    const dl = el('button', 'ghost-btn pj-small-btn', 'Download');
    dl.type = 'button';
    dl.addEventListener('click', () => download(f, blob));
    cap.append(el('span', 'fl-name', f.name), el('span', 'fl-meta', sizeLabel(f.size)), dl);
    card.append(img, cap);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    openPopup(PREVIEW, () => { overlay.remove(); URL.revokeObjectURL(url); });
    addCloseX(card, () => closePopup(PREVIEW));
    overlay.addEventListener('pointerdown', e => { if (e.target === overlay) closePopup(PREVIEW); });
  }
  function rename(f){
    const card = grid.querySelector('.fl-card[data-id="' + f.id + '"]');
    const nameEl = card && card.querySelector('.fl-name');
    if (!nameEl) return;
    const inp = el('input', 'fl-rename');
    inp.value = f.name;
    nameEl.replaceWith(inp);
    inp.focus();
    const dot = f.name.lastIndexOf('.');
    inp.setSelectionRange(0, dot > 0 ? dot : f.name.length);
    let done = false;
    const finish = save => {
      if (done) return;
      done = true;
      const name = inp.value.trim();
      if (save && name && name !== f.name) updateProject(projectId, p => { const x = p.files.find(y => y.id === f.id); if (x) x.name = name; });
      render();
    };
    inp.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter'){ e.preventDefault(); finish(true); }
      if (e.key === 'Escape'){ e.preventDefault(); finish(false); }
    });
    inp.addEventListener('blur', () => finish(true));
    inp.addEventListener('click', e => e.stopPropagation());
  }
  function remove(f){
    updateProject(projectId, p => { p.files = p.files.filter(x => x.id !== f.id); });
    deleteFiles([f.id]).catch(() => {});
    if (urls.has(f.id)){ URL.revokeObjectURL(urls.get(f.id)); urls.delete(f.id); }
    render();
    toast('Deleted “' + f.name + '”');
  }

  const fileOf = target => { const c = target.closest('.fl-card'); return c && files().find(f => f.id === c.dataset.id); };
  grid.addEventListener('click', e => { if (e.target.closest('.fl-rename')) return; const f = fileOf(e.target); if (f) open(f); });
  grid.addEventListener('contextmenu', e => {
    const f = fileOf(e.target);
    e.preventDefault();
    if (!f){ showContextMenu(e.clientX, e.clientY, [{ label: 'Add files', action: () => input.click() }]); return; }
    showContextMenu(e.clientX, e.clientY, [
      { label: 'Open', action: () => open(f) },
      { label: 'Download', action: () => download(f) },
      { label: 'Rename', action: () => rename(f) },
      { label: 'Delete', danger: true, action: () => remove(f) }
    ]);
  });
  addBtn.addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const list = [...input.files];
    input.value = '';
    if (list.length && await addFiles(projectId, list)) render();
  });

  render();
  return {
    destroy(){ urls.forEach(u => URL.revokeObjectURL(u)); urls.clear(); },
    refresh: render,
    pick: () => input.click()
  };
}
