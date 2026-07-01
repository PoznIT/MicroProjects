// Pure helpers ported verbatim from the original TimePunch (utils.js / data.js).

export const WEEK_TARGET = 42;
export const DAY_TARGET = WEEK_TARGET / 5;
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function timeToH(t) {
  const [h, m] = t.split(':').map(Number);
  return h + m / 60;
}

export function fmtH(h, signed = false) {
  if (h === 0 && !signed) return '—';
  const sign = signed ? (h >= 0 ? '+' : '-') : '';
  const abs = Math.abs(h);
  const hh = Math.floor(abs);
  const mm = Math.round((abs - hh) * 60);
  return `${sign}${hh}h${mm > 0 ? String(mm).padStart(2, '0') : ''}`;
}

export function isoWeek(dateStr) {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

export function weekKey(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay() || 7;
  const mon = new Date(d);
  mon.setDate(d.getDate() - day + 1);
  return mon.toISOString().slice(0, 10);
}

export function weekLabel(wk) {
  const mon = new Date(wk);
  const sun = new Date(wk);
  sun.setDate(sun.getDate() + 6);
  const fmt = d => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `W${isoWeek(wk)}  ${fmt(mon)} – ${fmt(sun)}`;
}

export function workedHours(punches) {
  let total = 0;
  for (let i = 0; i + 1 < punches.length; i += 2)
    total += timeToH(punches[i + 1]) - timeToH(punches[i]);
  return total;
}

// Cumulative balance through days[0..dayIndex] (skips days with no punches).
export function balanceUpTo(days, dayIndex) {
  let bal = 0;
  for (let i = 0; i <= dayIndex; i++) {
    const d = days[i];
    if (!d || d.punches.length === 0) continue;
    bal += workedHours(d.punches) - DAY_TARGET;
  }
  return bal;
}

export const todayISO = () => new Date().toISOString().slice(0, 10);
