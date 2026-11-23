/* ============================================================
   PROJECT FILES (2e) — the files' contents live in IndexedDB
   (localStorage holds a few MB of text at most); the project
   only keeps each file's metadata { id, name, size, type, added }.
   Records: { id, projectId, blob }.
============================================================ */
const DB = 'ideally-files', STORE = 'files';
let dbPromise = null;

function open(){
  if (!dbPromise){
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)){ reject(new Error('IndexedDB is not available')); return; }
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    dbPromise.catch(() => { dbPromise = null; });
  }
  return dbPromise;
}

async function run(mode, fn){
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const result = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Storage aborted (out of space?)'));
  });
}

export const putFile = (id, projectId, blob) => run('readwrite', s => s.put({ id, projectId, blob }));
export const getFileBlob = async id => { const rec = await run('readonly', s => s.get(id)); return rec ? rec.blob : null; };
export const deleteFiles = ids => ids.length ? run('readwrite', s => { ids.forEach(id => s.delete(id)); }) : Promise.resolve();
