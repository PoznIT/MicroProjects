import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  WEEK_TARGET, DAY_TARGET, WEEKDAYS,
  timeToH, fmtH, weekKey, weekLabel, workedHours, balanceUpTo, todayISO,
} from './timepunch-utils.js';
import './TimePunch.css';

const STORE_KEY = 'timepunch_days';

function loadDays() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null') || []; }
  catch { return []; }
}

export default function TimePunch({ theme, toggle }) {
  const [days, setDays] = useState(loadDays);
  const [toastMsg, setToastMsg] = useState('');
  const [timeModal, setTimeModal] = useState(null);   // {date, idx, hour, min, editing}
  const [dayModal, setDayModal] = useState(null);      // {value}
  const [importModal, setImportModal] = useState(null);// {pending, mode}
  const fileRef = useRef(null);
  const toastTimer = useRef(null);

  // Persist on every change (mirrors the original save()).
  useEffect(() => { localStorage.setItem(STORE_KEY, JSON.stringify(days)); }, [days]);

  const toast = useCallback(msg => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), 2200);
  }, []);

  // Always keep days sorted by date, like the original.
  const commit = useCallback(next => {
    setDays([...next].sort((a, b) => a.date.localeCompare(b.date)));
  }, []);

  // ── Punch / time modal ──────────────────────────────────────
  function openAddPunch(date) {
    const d = days.find(x => x.date === date);
    const idx = d.punches.length;
    let h = new Date().getHours();
    let m = Math.floor(new Date().getMinutes() / 5) * 5;
    if (d.punches.length > 0) { h = Math.floor(timeToH(d.punches[d.punches.length - 1]) + 0.5); m = 0; }
    setTimeModal({ date, idx, hour: h % 24, min: m, editing: false });
  }
  function editPunch(date, idx) {
    const d = days.find(x => x.date === date);
    const [h, m] = d.punches[idx].split(':').map(Number);
    setTimeModal({ date, idx, hour: h, min: m, editing: true });
  }
  function adjustTime(part, delta) {
    setTimeModal(s => part === 'h'
      ? { ...s, hour: (s.hour + delta + 24) % 24 }
      : { ...s, min: (s.min + delta * 5 + 60) % 60 });
  }
  function confirmTime() {
    const { date, idx, hour, min, editing } = timeModal;
    const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    const next = days.map(d => {
      if (d.date !== date) return d;
      const punches = [...d.punches];
      if (editing) punches[idx] = timeStr; else punches.push(timeStr);
      return { ...d, punches };
    });
    commit(next);
    setTimeModal(null);
    toast(`Punch ${editing ? 'updated' : 'added'}: ${timeStr}`);
  }

  // ── Add-day modal ───────────────────────────────────────────
  function openAddDay() {
    const last = days.length ? days[days.length - 1].date : todayISO();
    const next = new Date(last);
    next.setDate(next.getDate() + 1);
    setDayModal({ value: next.toISOString().slice(0, 10) });
  }
  function confirmAddDay() {
    const val = dayModal.value;
    if (!val) return;
    if (days.find(d => d.date === val)) { toast('Date already exists!'); return; }
    commit([...days, { date: val, punches: [] }]);
    setDayModal(null);
    toast('Day added');
  }

  // ── Day / punch actions ─────────────────────────────────────
  function deleteDay(date) {
    if (!window.confirm(`Delete ${date.slice(8)}.${date.slice(5, 7)}.${date.slice(0, 4)}?`)) return;
    commit(days.filter(d => d.date !== date));
    toast('Day removed');
  }
  function toggleDayOff(date) {
    let msg = '';
    const next = days.map(d => {
      if (d.date !== date) return d;
      if (d.dayOff) { msg = 'Marked as work day'; const { dayOff, ...rest } = d; return rest; }
      msg = 'Marked as day off'; return { ...d, dayOff: true, punches: [] };
    });
    commit(next);
    toast(msg);
  }
  function deletePunch(date, idx) {
    const next = days.map(d => d.date === date
      ? { ...d, punches: d.punches.filter((_, i) => i !== idx) } : d);
    commit(next);
    toast('Punch removed');
  }

  // ── CSV ─────────────────────────────────────────────────────
  function triggerImport() { if (fileRef.current) { fileRef.current.value = ''; fileRef.current.click(); } }
  function importCSV(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const lines = ev.target.result.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { toast('CSV appears empty'); return; }
      const header = lines[0].split(',');
      const dateCol = header.indexOf('Date');
      if (dateCol === -1) { toast('No Date column found'); return; }
      const punchCols = header.reduce((acc, h, i) => { if (/^P\d+$/.test(h.trim())) acc.push(i); return acc; }, []);
      const parsed = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        const date = cols[dateCol] && cols[dateCol].trim();
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        const punches = punchCols.map(ci => cols[ci] && cols[ci].trim()).filter(v => v && /^\d{2}:\d{2}$/.test(v));
        parsed.push({ date, punches });
      }
      if (parsed.length === 0) { toast('No valid rows found in CSV'); return; }
      setImportModal({ pending: parsed, mode: 'merge' });
    };
    reader.readAsText(file);
  }
  function confirmImport() {
    const { pending, mode } = importModal;
    let next;
    if (mode === 'replace') { next = pending; }
    else {
      next = [...days];
      pending.forEach(inc => {
        const ex = next.findIndex(d => d.date === inc.date);
        if (ex >= 0) next[ex] = inc; else next.push(inc);
      });
    }
    commit(next);
    setImportModal(null);
    toast(`${pending.length} day(s) imported`);
  }
  function exportCSV() {
    const maxP = Math.max(...days.map(d => d.punches.length), 2);
    const pHeaders = Array.from({ length: maxP }, (_, i) => `P${i + 1}`).join(',');
    const out = [`Date,${pHeaders},Worked_h,Expected_h,Delta_h,Balance_h`];
    days.forEach((d, i) => {
      const w = workedHours(d.punches);
      const exp = d.punches.length > 0 ? DAY_TARGET : 0;
      const bal = balanceUpTo(days, i);
      const ps = [...d.punches, ...Array(maxP - d.punches.length).fill('')];
      out.push([d.date, ...ps, w.toFixed(2), exp.toFixed(2), (w - exp).toFixed(2), bal.toFixed(2)].join(','));
    });
    const blob = new Blob([out.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'timepunch.csv';
    a.click();
  }

  // ── Keyboard shortcuts ──────────────────────────────────────
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') { setTimeModal(null); setDayModal(null); setImportModal(null); }
      if (e.key === 'Enter') {
        if (timeModal) confirmTime();
        else if (dayModal) confirmAddDay();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  // ── Derived: weeks + stats ──────────────────────────────────
  const weekMap = {};
  days.forEach(d => { (weekMap[weekKey(d.date)] ||= []).push(d); });
  const weekKeys = Object.keys(weekMap).sort();

  const now = todayISO();
  const monthWorked = days.reduce((s, d) => s + workedHours(d.punches), 0);
  const curWk = weekKey(now);
  const wkDays = days.filter(d => weekKey(d.date) === curWk);
  const wkWorked = wkDays.reduce((s, d) => s + workedHours(d.punches), 0);
  const wkDelta = wkWorked - WEEK_TARGET;
  const todayDay = days.find(d => d.date === now);
  const todayWorked = todayDay ? workedHours(todayDay.punches) : null;
  const overallBalance = balanceUpTo(days, days.length - 1);
  const months = [...new Set(days.map(d => d.date.slice(0, 7)))];
  let monthBadge = '';
  if (months.length === 1) {
    const [y, m] = months[0].split('-');
    monthBadge = `${new Date(y, m - 1).toLocaleString('en', { month: 'long' })} ${y}`;
  } else if (months.length > 1) monthBadge = `${months.length} months`;

  const statCls = (cond) => 'stat ' + (cond ? 'positive' : 'negative');

  return (
    <div className="tp">
      {/* TOP BAR */}
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to="/" style={{ color: 'var(--dim)', textDecoration: 'none', fontSize: 12, letterSpacing: '.5px' }}>← home</Link>
          <div className="logo">Time<span>Punch</span></div>
        </div>
        <div className="topbar-right">
          <span className="badge">{monthBadge}</span>
          <button className="btn btn-ghost" onClick={toggle} title="Toggle light/dark">{theme === 'light' ? '☀️' : '🌙'}</button>
          <button className="btn btn-ghost" onClick={triggerImport}>↑ Import CSV</button>
          <button className="btn btn-ghost" onClick={exportCSV}>↓ Export CSV</button>
          <button className="btn btn-primary" onClick={openAddDay}>+ Add Day</button>
        </div>
      </header>

      {/* STATS */}
      <div className="stats">
        <div className="stat neutral">
          <div className="stat-label">Month Worked</div>
          <div className="stat-val">{fmtH(monthWorked)}</div>
          <div className="stat-sub">{monthWorked.toFixed(1)}h logged</div>
        </div>
        <div className={'stat ' + (wkWorked >= WEEK_TARGET ? 'positive' : 'neutral')}>
          <div className="stat-label">This Week</div>
          <div className="stat-val">{fmtH(wkWorked)}</div>
          <div className="stat-sub">{wkWorked.toFixed(1)} / {WEEK_TARGET}h</div>
        </div>
        <div className={statCls(wkDelta >= 0)}>
          <div className="stat-label">Week Delta</div>
          <div className="stat-val">{fmtH(wkDelta, true)}</div>
          <div className="stat-sub">{wkDelta >= 0 ? 'ahead of target' : 'behind target'}</div>
        </div>
        <div className={todayDay ? statCls((todayWorked - DAY_TARGET) >= 0) : 'stat neutral'}>
          <div className="stat-label">Today</div>
          <div className="stat-val">{todayDay ? (fmtH(todayWorked) || '0h') : '—'}</div>
          <div className="stat-sub">{todayDay ? `${fmtH(todayWorked - DAY_TARGET, true)} vs ${fmtH(DAY_TARGET)} target` : 'no entry today'}</div>
        </div>
        <div className={statCls(overallBalance >= 0)}>
          <div className="stat-label">Overall Balance</div>
          <div className="stat-val">{fmtH(overallBalance, true)}</div>
          <div className="stat-sub">{overallBalance >= 0 ? 'ahead overall' : 'behind overall'}</div>
        </div>
      </div>

      {/* WEEKS */}
      <main className="main">
        {weekKeys.map(wk => {
          const wDays = weekMap[wk];
          const wWorked = wDays.reduce((s, d) => s + workedHours(d.punches), 0);
          const wDelta = wWorked - WEEK_TARGET;
          const partial = wDays.length < 5;
          const lastIdx = days.indexOf(wDays[wDays.length - 1]);
          const wkBalance = balanceUpTo(days, lastIdx);
          return (
            <div key={wk} style={{ marginBottom: 24 }}>
              <div className="section-label">{weekLabel(wk)}{partial ? ' · in progress' : ''}</div>
              <div className="table-wrap">
                <table>
                  <thead><tr>
                    <th>Date</th><th>Punches</th><th>Worked</th><th>Expected</th><th>Day Δ</th><th>Balance</th><th></th>
                  </tr></thead>
                  <tbody>
                    {wDays.map(d => {
                      const dayIdx = days.indexOf(d);
                      const worked = workedHours(d.punches);
                      const dayOff = d.dayOff === true || d.punches.length === 0;
                      const exp = dayOff ? 0 : DAY_TARGET;
                      const delta = worked - exp;
                      const balance = balanceUpTo(days, dayIdx);
                      const pct = Math.min(worked / DAY_TARGET, 1.2);
                      const dObj = new Date(d.date);
                      const dd = String(dObj.getDate()).padStart(2, '0');
                      const mm = String(dObj.getMonth() + 1).padStart(2, '0');
                      const isToday = d.date === now;
                      let deltaClass = 'zero', deltaText = '—';
                      if (!dayOff && worked > 0) { deltaClass = delta >= 0 ? 'pos' : 'neg'; deltaText = fmtH(delta, true); }
                      else if (!dayOff) { deltaClass = 'neg'; deltaText = fmtH(-exp, true); }
                      return (
                        <tr key={d.date} className={d.dayOff || d.punches.length === 0 ? 'day-off' : ''}>
                          <td><span className="date-cell">{dd}.{mm}
                            <span className="weekday">{WEEKDAYS[dObj.getDay()]}</span>
                            {isToday && <span style={{ color: 'var(--accent)', fontSize: 9 }}> ●</span>}
                          </span></td>
                          <td>
                            <div className="punches">
                              {d.punches.map((p, i) => (
                                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                  {i > 0 && i % 2 === 0 && <span className="punch-arrow">·</span>}
                                  <span className={'punch-chip ' + (i % 2 === 0 ? 'in-punch' : 'out-punch')}
                                        onClick={() => editPunch(d.date, i)} title="Click to edit">{p}</span>
                                  <span className="del-punch-btn" onClick={() => deletePunch(d.date, i)} title="Delete punch">×</span>
                                </span>
                              ))}
                              {!d.dayOff && <button className="add-punch-btn" onClick={() => openAddPunch(d.date)}>+ punch</button>}
                            </div>
                          </td>
                          <td>
                            {dayOff ? <span className="hours-cell">day off</span> : (
                              <div className="prog-wrap">
                                <span className={'hours-cell' + (worked > 0 ? ' has-value' : '')}>{worked > 0 ? fmtH(worked) : '—'}</span>
                                {worked > 0 && <div className="prog-bar"><div className={'prog-fill' + (pct >= 1 ? ' over' : '')} style={{ width: pct * 100 + '%' }} /></div>}
                              </div>
                            )}
                          </td>
                          <td><span className={'hours-cell' + (!dayOff ? ' has-value' : '')}>{dayOff ? '—' : fmtH(exp)}</span></td>
                          <td><span className={'delta-cell ' + deltaClass}>{deltaText}</span></td>
                          <td>{dayOff ? <span className="delta-cell zero">—</span> : <span className={'delta-cell ' + (balance >= 0 ? 'pos' : 'neg')}>{fmtH(balance, true)}</span>}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <button className={'dayoff-btn' + (d.dayOff ? ' is-off' : '')} onClick={() => toggleDayOff(d.date)} title="Toggle day off">{d.dayOff ? 'work day' : 'day off'}</button>{' '}
                            <button className="del-btn" onClick={() => deleteDay(d.date)} title="Delete day">×</button>
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="week-row">
                      <td><span className="week-label">{weekLabel(wk)}</span></td>
                      <td></td>
                      <td><span className="week-total">{fmtH(wWorked)}</span></td>
                      <td><span className="hours-cell has-value" style={{ color: 'var(--blue)' }}>{WEEK_TARGET}h</span></td>
                      <td><span className={'week-delta ' + (wDelta >= 0 ? 'pos' : 'neg')}>{fmtH(wDelta, true)}</span></td>
                      <td><span className={'week-delta ' + (wkBalance >= 0 ? 'pos' : 'neg')}>{fmtH(wkBalance, true)}</span></td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </main>

      {/* TIME MODAL */}
      {timeModal && (
        <div className="overlay open" onClick={e => { if (e.target === e.currentTarget) setTimeModal(null); }}>
          <div className="modal">
            <div className="modal-title">{(timeModal.editing ? 'Edit ' : '') + (timeModal.idx % 2 === 0 ? 'Punch In' : 'Punch Out')}</div>
            <div className="modal-sub">{timeModal.date.slice(8)}.{timeModal.date.slice(5, 7)} · punch {timeModal.idx + 1}</div>
            <div className="time-display">
              <div className="time-col">
                <div className="time-arrow" onClick={() => adjustTime('h', 1)}>▲</div>
                <div className="time-val">{String(timeModal.hour).padStart(2, '0')}</div>
                <div className="time-arrow" onClick={() => adjustTime('h', -1)}>▼</div>
              </div>
              <div className="time-sep">:</div>
              <div className="time-col">
                <div className="time-arrow" onClick={() => adjustTime('m', 1)}>▲</div>
                <div className="time-val">{String(timeModal.min).padStart(2, '0')}</div>
                <div className="time-arrow" onClick={() => adjustTime('m', -1)}>▼</div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setTimeModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmTime}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT MODAL */}
      {importModal && (
        <div className="overlay open" onClick={e => { if (e.target === e.currentTarget) setImportModal(null); }}>
          <div className="modal" style={{ width: 400 }}>
            <div className="modal-title">Import CSV</div>
            <div className="modal-sub">{importModal.pending.length} day(s) found in CSV</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {[['merge', 'Merge', 'Add new days; overwrite existing dates with CSV data'],
                ['replace', 'Replace all', 'Discard all current data and load only the CSV']].map(([val, t, sub]) => (
                <label key={val} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--s2)' }}>
                  <input type="radio" name="import-mode" value={val} checked={importModal.mode === val}
                         onChange={() => setImportModal(s => ({ ...s, mode: val }))} style={{ marginTop: 2 }} />
                  <div>
                    <div style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{t}</div>
                    <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2, fontFamily: 'var(--sans)' }}>{sub}</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setImportModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmImport}>Import</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD DAY MODAL */}
      {dayModal && (
        <div className="overlay open" onClick={e => { if (e.target === e.currentTarget) setDayModal(null); }}>
          <div className="modal">
            <div className="modal-title">New Day</div>
            <div className="modal-sub">Add a new day to track</div>
            <div className="date-input-wrap">
              <div className="date-input-label">DATE</div>
              <input className="date-input" type="date" value={dayModal.value}
                     onChange={e => setDayModal({ value: e.target.value })} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setDayModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmAddDay}>Add Day</button>
            </div>
          </div>
        </div>
      )}

      <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={importCSV} />
      <div className={'toast' + (toastMsg ? ' show' : '')}>{toastMsg}</div>
    </div>
  );
}
