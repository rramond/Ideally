import { store } from '../lib/storage.js';
import { farthestColor } from '../lib/palette.js';

/* ============================================================
   PROJECTS (2) — data. Project: { id, name, color, created }
   2c–e will add the content (notes, files, timeline items);
   contentCount() already feeds the circle sizes.
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

/* how much is inside a project — 0 until 2c–e add notes, files and a timeline */
export const contentCount = p =>
  (p.notes ? p.notes.length : 0) + (p.files ? p.files.length : 0) + (p.timeline ? p.timeline.length : 0);

/* a new project is offered the color farthest from the existing ones */
export const suggestColor = exceptId => farthestColor(projects.filter(p => p.id !== exceptId).map(p => p.color));

export function saveProject(p){
  const i = projects.findIndex(x => x.id === p.id);
  if (i < 0) projects.push(p); else projects[i] = p;
  persist();
}
export function deleteProject(id){
  projects = projects.filter(p => p.id !== id);
  persist();
}
