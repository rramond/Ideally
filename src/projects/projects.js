import { store } from '../lib/storage.js';
import { farthestColor } from '../lib/palette.js';
import { deleteFiles } from './fileStore.js';

/* ============================================================
   PROJECTS (2) — data. Project:
   { id, name, color, created,
     notes:    [{ id, title, body, updated }],                 (2c)
     timeline: [{ id, name, date, end|null, done, desc }],     (2d) dates 'YYYY-MM-DD'
     files:    [{ id, name, size, type, added }] }             (2e) contents in fileStore.js
   contentCount() feeds the droplet sizes.
============================================================ */
let projects = store.get('ideally.projects', []);
const listeners = [];
export const onProjectsChange = fn => listeners.push(fn);
function persist(){
  store.set('ideally.projects', projects);
  listeners.forEach(fn => fn());
}

export const getProjects = () => projects;
export const getProject = id => projects.find(p => p.id === id);

/* how much is inside a project: its notes, timeline items and files */
export const contentCount = p =>
  (p.notes ? p.notes.length : 0) + (p.files ? p.files.length : 0) + (p.timeline ? p.timeline.length : 0);

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
  p.notes ||= []; p.timeline ||= []; p.files ||= [];
  fn(p);
  persist();
}

export function deleteProject(id){
  const p = getProject(id);
  projects = projects.filter(x => x.id !== id);
  persist();
  if (p && p.files && p.files.length) deleteFiles(p.files.map(f => f.id)).catch(() => {});
}
