let days = JSON.parse(localStorage.getItem('timepunch_days') || "null") || [];

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
