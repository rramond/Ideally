/* Date and time helpers. Dates are 'YYYY-MM-DD' strings, times 'HH:MM'. */
export const pad = n => String(n).padStart(2, '0');
export const isoDate = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const mondayOf = d => addDays(d, -((d.getDay() + 6) % 7));
export const parseIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
/* whole days since the epoch — DST-proof day differences */
export const dayNumber = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000; };
export const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
export const toHours = t => { const [h, m] = t.split(':').map(Number); return h + m / 60; };
export const fromHours = h => {
  const mins = Math.round(h * 60);
  return pad(Math.floor(mins / 60)) + ':' + pad(mins % 60);
};
