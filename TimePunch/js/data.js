let days = JSON.parse(localStorage.getItem('timepunch_days') || 'null') || [
  { date: '2026-03-02', punches: ['09:30', '12:10', '13:00', '16:22', '17:05', '18:30'] },
  { date: '2026-03-03', punches: ['08:45', '12:10', '12:45', '17:30'] },
  { date: '2026-03-04', punches: ['06:30', '08:00', '09:00', '12:00', '12:50', '17:00'] },
  { date: '2026-03-05', punches: ['08:00', '12:00', '12:30', '16:30'] },
  { date: '2026-03-06', punches: ['08:00', '12:00', '12:45', '17:30'] },
  { date: '2026-03-07', punches: [] },
  { date: '2026-03-08', punches: [] },
  { date: '2026-03-09', punches: ['08:00', '12:00', '12:30', '17:00'] },
  { date: '2026-03-10', punches: ['06:30', '08:25'] },
];

function save() {
  localStorage.setItem('timepunch_days', JSON.stringify(days));
}

function workedHours(punches) {
  let total = 0;
  for (let i = 0; i + 1 < punches.length; i += 2)
    total += timeToH(punches[i + 1]) - timeToH(punches[i]);
  return total;
}

function balanceUpTo(dayIndex) {
  let bal = 0;
  for (let i = 0; i <= dayIndex; i++) {
    const d = days[i];
    if (d.punches.length === 0) continue;
    bal += workedHours(d.punches) - DAY_TARGET;
  }
  return bal;
}
