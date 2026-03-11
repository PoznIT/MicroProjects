let pendingImportData = null;

function triggerImport() {
  document.getElementById('csv-import-input').value = '';
  document.getElementById('csv-import-input').click();
}

function importCSV(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const lines = e.target.result.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) { toast('CSV appears empty'); return; }

    const header = lines[0].split(',');
    const dateCol = header.indexOf('Date');
    if (dateCol === -1) { toast('No Date column found'); return; }

    const punchCols = header.reduce((acc, h, i) => {
      if (/^P\d+$/.test(h.trim())) acc.push(i);
      return acc;
    }, []);

    const parsed = [];
    for (let i = 1; i < lines.length; i++) {
      const cols  = lines[i].split(',');
      const date  = cols[dateCol] && cols[dateCol].trim();
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const punches = punchCols
        .map(ci => cols[ci] && cols[ci].trim())
        .filter(v => v && /^\d{2}:\d{2}$/.test(v));
      parsed.push({ date, punches });
    }

    if (parsed.length === 0) { toast('No valid rows found in CSV'); return; }

    pendingImportData = parsed;
    document.getElementById('import-modal-sub').textContent = `${parsed.length} day(s) found in CSV`;
    document.getElementById('import-modal').classList.add('open');
  };
  reader.readAsText(file);
}

function confirmImport() {
  if (!pendingImportData) return;
  const mode = document.querySelector('input[name="import-mode"]:checked').value;

  if (mode === 'replace') {
    days = pendingImportData;
  } else {
    pendingImportData.forEach(incoming => {
      const existing = days.findIndex(d => d.date === incoming.date);
      if (existing >= 0) days[existing] = incoming;
      else days.push(incoming);
    });
    days.sort((a, b) => a.date.localeCompare(b.date));
  }

  save();
  closeImportModal();
  render();
  toast(`${pendingImportData.length} day(s) imported`);
  pendingImportData = null;
}

function closeImportModal() {
  document.getElementById('import-modal').classList.remove('open');
  pendingImportData = null;
}

function exportCSV() {
  const maxP    = Math.max(...days.map(d => d.punches.length), 2);
  const pHeaders = Array.from({ length: maxP }, (_, i) => `P${i + 1}`).join(',');
  const lines   = [`Date,${pHeaders},Worked_h,Expected_h,Delta_h,Balance_h`];
  days.forEach((d, i) => {
    const w   = workedHours(d.punches);
    const exp = d.punches.length > 0 ? DAY_TARGET : 0;
    const bal = balanceUpTo(i);
    const ps  = [...d.punches, ...Array(maxP - d.punches.length).fill('')];
    lines.push([d.date, ...ps, w.toFixed(2), exp.toFixed(2), (w - exp).toFixed(2), bal.toFixed(2)].join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'timepunch.csv';
  a.click();
}
