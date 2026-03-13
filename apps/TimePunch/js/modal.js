let modalState = { date: null, idx: null, hour: 8, min: 0, editing: false };

// ── TIME PICKER MODAL ────────────────────────────────────────

function openAddPunch(date) {
  const d   = days.find(x => x.date === date);
  const idx = d.punches.length;
  let h = new Date().getHours();
  let m = Math.floor(new Date().getMinutes() / 5) * 5;
  if (d.punches.length > 0) {
    const last = timeToH(d.punches[d.punches.length - 1]);
    h = Math.floor(last + 0.5);
    m = 0;
  }
  modalState = { date, idx, hour: h % 24, min: m, editing: false };
  document.getElementById('modal-title').textContent = idx % 2 === 0 ? 'Punch In' : 'Punch Out';
  const dd = date.slice(8), mm = date.slice(5, 7);
  document.getElementById('modal-sub').textContent = `${dd}.${mm} · punch ${idx + 1}`;
  setTimeDisplay();
  document.getElementById('time-modal').classList.add('open');
}

function editPunch(date, idx) {
  const d = days.find(x => x.date === date);
  const [h, m] = d.punches[idx].split(':').map(Number);
  modalState = { date, idx, hour: h, min: m, editing: true };
  document.getElementById('modal-title').textContent = idx % 2 === 0 ? 'Edit Punch In' : 'Edit Punch Out';
  const dd = date.slice(8), mm = date.slice(5, 7);
  document.getElementById('modal-sub').textContent = `${dd}.${mm} · punch ${idx + 1}`;
  setTimeDisplay();
  document.getElementById('time-modal').classList.add('open');
}

function setTimeDisplay() {
  document.getElementById('t-hour').textContent = String(modalState.hour).padStart(2, '0');
  document.getElementById('t-min').textContent  = String(modalState.min).padStart(2, '0');
}

function adjustTime(part, delta) {
  if (part === 'h') modalState.hour = (modalState.hour + delta + 24) % 24;
  else              modalState.min  = (modalState.min + delta * 5 + 60) % 60;
  setTimeDisplay();
}

function confirmTime() {
  const { date, idx, hour, min, editing } = modalState;
  const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  const d = days.find(x => x.date === date);
  if (editing) d.punches[idx] = timeStr;
  else         d.punches.push(timeStr);
  save();
  closeModal();
  render();
  toast(`Punch ${editing ? 'updated' : 'added'}: ${timeStr}`);
}

function closeModal() {
  document.getElementById('time-modal').classList.remove('open');
}

// ── ADD DAY MODAL ────────────────────────────────────────────

function openAddDay() {
  const lastDate = days.length ? days[days.length - 1].date : new Date().toISOString().slice(0, 10);
  const next = new Date(lastDate);
  next.setDate(next.getDate() + 1);
  document.getElementById('new-day-input').value = next.toISOString().slice(0, 10);
  document.getElementById('day-modal').classList.add('open');
}

function closeDayModal() {
  document.getElementById('day-modal').classList.remove('open');
}

function confirmAddDay() {
  const val = document.getElementById('new-day-input').value;
  if (!val) return;
  if (days.find(d => d.date === val)) { toast('Date already exists!'); return; }
  days.push({ date: val, punches: [] });
  days.sort((a, b) => a.date.localeCompare(b.date));
  save();
  closeDayModal();
  render();
  toast('Day added');
}

// ── DAY ACTIONS ──────────────────────────────────────────────

function deleteDay(date) {
  if (!confirm(`Delete ${date.slice(8)}.${date.slice(5, 7)}.${date.slice(0, 4)}?`)) return;
  days = days.filter(d => d.date !== date);
  save();
  render();
  toast('Day removed');
}

function toggleDayOff(date) {
  const d = days.find(x => x.date === date);
  if (d.dayOff) {
    delete d.dayOff;
    toast('Marked as work day');
  } else {
    d.dayOff = true;
    d.punches = [];
    toast('Marked as day off');
  }
  save();
  render();
}

function deletePunch(date, idx) {
  const d = days.find(x => x.date === date);
  d.punches.splice(idx, 1);
  save();
  render();
  toast('Punch removed');
}
