import { store } from '../lib/storage.js';
import { farthestColor } from '../lib/palette.js';
import { deleteFiles } from './fileStore.js';
import { normalizeItem } from './roadmap.js';

/* ============================================================
   PROJECTS (2) — data. Project:
   { id, name, color, created,
     notes:    [{ id, title, body, updated }],                 (2c)
     timeline: [roadmap items],                                (2d, 2h) see roadmap.js
     goals:    [{ id, name, color }],                          (2h) the roadmap's goal tags
     files:    [{ id, name, size, type, added }],              (2e) contents in fileStore.js
     board:    { items: [...], view: { x, y, z } } }           (2f) the whiteboard:
       sticky { id, kind: 'sticky', x, y, w, h, color, text }
       file   { id, kind: 'file', fileId, x, y, w, h }        a card for one of `files`
   contentCount() feeds the droplet sizes.
============================================================ */
let projects = store.get('ideally.projects', []);
/* 2h: timeline items became roadmap items (horizon, status, goal, rough dates, steps, documents) */
{
  let upgraded = false;
  projects.forEach(p => {
    (p.timeline || []).forEach(it => { if (normalizeItem(it)) upgraded = true; });
    if (p.timeline && !p.goals){ p.goals = []; upgraded = true; }
  });
  if (upgraded) store.set('ideally.projects', projects);
}
const listeners = [];
export const onProjectsChange = fn => listeners.push(fn);
function persist(){
  store.set('ideally.projects', projects);
  listeners.forEach(fn => fn());
}

export const getProjects = () => projects;
export const getProject = id => projects.find(p => p.id === id);

/* the board's stickies */
export const stickyCount = p => p.board ? p.board.items.filter(i => i.kind === 'sticky').length : 0;

/* how much is inside a project: its stickies, notes, timeline items and files */
export const contentCount = p =>
  stickyCount(p) + (p.notes ? p.notes.length : 0) + (p.files ? p.files.length : 0) + (p.timeline ? p.timeline.length : 0);

/* a new project is offered the color farthest from the existing ones */
export const suggestColor = exceptId => farthestColor(projects.filter(p => p.id !== exceptId).map(p => p.color));

export function saveProject(p){
  const i = projects.findIndex(x => x.id === p.id);
  if (i < 0) projects.push(p); else projects[i] = p;
  persist();
}

/* change a project in place: fn(project) mutates it (lists are created on first use) */
export function updateProject(id, fn){
  const p = getProject(id);
  if (!p) return;
  p.notes ||= []; p.timeline ||= []; p.files ||= []; p.goals ||= [];
  p.board ||= { items: [], view: { x: 0, y: 0, z: 1 } };
  fn(p);
  persist();
}

export function deleteProject(id){
  const p = getProject(id);
  projects = projects.filter(x => x.id !== id);
  persist();
  if (p && p.files && p.files.length) deleteFiles(p.files.map(f => f.id)).catch(() => {});
}
