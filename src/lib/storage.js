/* ============================================================
   Storage — localStorage with an in-memory fallback
============================================================ */
export const store = {
  ok: (() => { try { localStorage.setItem('__t','1'); localStorage.removeItem('__t'); return true; } catch(e){ return false; } })(),
  mem: {},
  get(key, fallback){
    try {
      let raw = this.ok ? localStorage.getItem(key) : this.mem[key];
      if (raw == null && this.ok && key.startsWith('ideally.')){
        const legacy = localStorage.getItem(key.replace('ideally.', 'slate.'));
        if (legacy != null){ localStorage.setItem(key, legacy); raw = legacy; }
      }
      return raw ? JSON.parse(raw) : fallback;
    } catch(e){ return fallback; }
  },
  set(key, value){
    const raw = JSON.stringify(value);
    if (this.ok) { try { localStorage.setItem(key, raw); } catch(e){} }
    else this.mem[key] = raw;
  }
};
