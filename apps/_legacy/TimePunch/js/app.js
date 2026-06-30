// ── KEYBOARD SHORTCUTS ───────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModal();
    closeDayModal();
    closeImportModal();
  }
  if (e.key === 'Enter') {
    if (document.getElementById('time-modal').classList.contains('open')) confirmTime();
    if (document.getElementById('day-modal').classList.contains('open'))  confirmAddDay();
  }
});

// ── CLOSE MODALS ON BACKDROP CLICK ──────────────────────────
document.getElementById('time-modal').addEventListener('click',   e => { if (e.target === e.currentTarget) closeModal(); });
document.getElementById('day-modal').addEventListener('click',    e => { if (e.target === e.currentTarget) closeDayModal(); });
document.getElementById('import-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeImportModal(); });

// ── INIT ─────────────────────────────────────────────────────
initTheme();
render();
