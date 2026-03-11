function toggleTheme() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const next    = isLight ? 'dark' : 'light';
  applyTheme(next);
  localStorage.setItem('timepunch-theme', next);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('theme-toggle').textContent = theme === 'light' ? '☀️' : '🌙';
}

function initTheme() {
  const saved = localStorage.getItem('timepunch-theme') || 'dark';
  applyTheme(saved);
}
