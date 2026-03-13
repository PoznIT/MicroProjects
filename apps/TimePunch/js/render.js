function render() {
  const weekMap = {};
  days.forEach(d => {
    const wk = weekKey(d.date);
    if (!weekMap[wk]) weekMap[wk] = [];
    weekMap[wk].push(d);
  });

  const container = document.getElementById('weeks-container');
  container.innerHTML = '';

  Object.keys(weekMap).sort().forEach(wk => {
    const wDays   = weekMap[wk];
    const wWorked = wDays.reduce((s, d) => s + workedHours(d.punches), 0);
    const wDelta  = wWorked - WEEK_TARGET;
    const partial = wDays.length < 5;

    const section = document.createElement('div');
    section.style.marginBottom = '24px';

    const label = document.createElement('div');
    label.className = 'section-label';
    label.textContent = weekLabel(wk) + (partial ? ' · in progress' : '');
    section.appendChild(label);

    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';

    const table = document.createElement('table');
    table.innerHTML = `<thead><tr>
      <th>Date</th>
      <th>Punches</th>
      <th>Worked</th>
      <th>Expected</th>
      <th>Day Δ</th>
      <th>Balance</th>
      <th></th>
    </tr></thead>`;

    const tbody = document.createElement('tbody');

    wDays.forEach(d => {
      const dayIdx  = days.indexOf(d);
      const worked  = workedHours(d.punches);
      const dayOff  = d.dayOff === true || d.punches.length === 0;
      const exp     = dayOff ? 0 : DAY_TARGET;
      const delta   = worked - exp;
      const balance = balanceUpTo(dayIdx);
      const pct     = Math.min(worked / DAY_TARGET, 1.2);
      const isToday = d.date === new Date().toISOString().slice(0, 10);

      const tr = document.createElement('tr');
      if (dayOff) tr.classList.add('day-off');

      const dateObj = new Date(d.date);
      const dd = String(dateObj.getDate()).padStart(2, '0');
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      const wd = WEEKDAYS[dateObj.getDay()];

      const punchHTML = buildPunchHTML(d);

      const workedHTML = dayOff
        ? '<span class="hours-cell">day off</span>'
        : `<div class="prog-wrap">
            <span class="hours-cell ${worked > 0 ? 'has-value' : ''}">${worked > 0 ? fmtH(worked) : '—'}</span>
            ${worked > 0 ? `<div class="prog-bar"><div class="prog-fill ${pct >= 1 ? 'over' : ''}" style="width:${pct * 100}%"></div></div>` : ''}
          </div>`;

      let deltaClass = 'zero', deltaText = '—';
      if (!dayOff && worked > 0) {
        deltaClass = delta >= 0 ? 'pos' : 'neg';
        deltaText  = fmtH(delta, true);
      } else if (!dayOff) {
        deltaClass = 'neg';
        deltaText  = fmtH(-exp, true);
      }

      const balClass = balance >= 0 ? 'pos' : 'neg';
      const balHTML  = dayOff
        ? '<span class="delta-cell zero">—</span>'
        : `<span class="delta-cell ${balClass}">${fmtH(balance, true)}</span>`;

      tr.innerHTML =
        `<td><span class="date-cell">${dd}.${mm}` +
          `<span class="weekday">${wd}</span>` +
          (isToday ? ' <span style="color:var(--accent);font-size:9px">●</span>' : '') +
        `</span></td>` +
        `<td>${punchHTML}</td>` +
        `<td>${workedHTML}</td>` +
        `<td><span class="hours-cell${!dayOff ? ' has-value' : ''}">${dayOff ? '—' : fmtH(exp)}</span></td>` +
        `<td><span class="delta-cell ${deltaClass}">${deltaText}</span></td>` +
        `<td>${balHTML}</td>` +
        `<td style="white-space:nowrap">` +
          `<button class="dayoff-btn${d.dayOff ? ' is-off' : ''}" onclick="toggleDayOff('${d.date}')" title="Toggle day off">${d.dayOff ? 'work day' : 'day off'}</button> ` +
          `<button class="del-btn" onclick="deleteDay('${d.date}')" title="Delete day">×</button>` +
        `</td>`;

      tbody.appendChild(tr);
    });

    // Week summary row
    const wtr = document.createElement('tr');
    wtr.classList.add('week-row');
    const lastDayOfWk = wDays[wDays.length - 1];
    const wkBalance   = balanceUpTo(days.indexOf(lastDayOfWk));
    const wDeltaClass = wDelta >= 0 ? 'pos' : 'neg';
    const wBalClass   = wkBalance >= 0 ? 'pos' : 'neg';
    wtr.innerHTML = `
      <td><span class="week-label">${weekLabel(wk)}</span></td>
      <td></td>
      <td><span class="week-total">${fmtH(wWorked)}</span></td>
      <td><span class="hours-cell has-value" style="color:var(--blue)">${WEEK_TARGET}h</span></td>
      <td><span class="week-delta ${wDeltaClass}">${fmtH(wDelta, true)}</span></td>
      <td><span class="week-delta ${wBalClass}">${fmtH(wkBalance, true)}</span></td>
      <td></td>`;
    tbody.appendChild(wtr);

    table.appendChild(tbody);
    wrap.appendChild(table);
    section.appendChild(wrap);
    container.appendChild(section);
  });

  updateStats();
}

function buildPunchHTML(d) {
  let html = '<div class="punches">';
  d.punches.forEach((p, i) => {
    if (i > 0 && i % 2 === 0) html += '<span class="punch-arrow">·</span>';
    const cls = i % 2 === 0 ? 'in-punch' : 'out-punch';
    html +=
      `<span class="punch-chip-wrap" style="display:inline-flex;align-items:center;gap:2px">` +
        `<span class="punch-chip ${cls}" onclick="editPunch('${d.date}',${i})" title="Click to edit">${p}</span>` +
        `<span class="del-punch-btn" onclick="deletePunch('${d.date}',${i})" title="Delete punch"` +
          ` style="cursor:pointer;color:var(--dim2);font-size:11px;padding:1px 3px;border-radius:3px;line-height:1;transition:all 0.15s"` +
          ` onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--dim2)'">×</span>` +
      `</span>`;
  });
  if (!d.dayOff) html += `<button class="add-punch-btn" onclick="openAddPunch('${d.date}')">+ punch</button>`;
  html += '</div>';
  return html;
}

function updateStats() {
  const monthWorked = days.reduce((s, d) => s + workedHours(d.punches), 0);
  document.getElementById('val-month').textContent = fmtH(monthWorked);
  document.getElementById('sub-month').textContent = `${monthWorked.toFixed(1)}h logged`;

  const now      = new Date().toISOString().slice(0, 10);
  const curWk    = weekKey(now);
  const wkDays   = days.filter(d => weekKey(d.date) === curWk);
  const wkWorked = wkDays.reduce((s, d) => s + workedHours(d.punches), 0);
  const wkDelta  = wkWorked - WEEK_TARGET;

  document.getElementById('val-week').textContent = fmtH(wkWorked);
  document.getElementById('sub-week').textContent = `${wkWorked.toFixed(1)} / ${WEEK_TARGET}h`;
  document.getElementById('stat-week').className  = 'stat ' + (wkWorked >= WEEK_TARGET ? 'positive' : 'neutral');

  document.getElementById('val-delta').textContent = fmtH(wkDelta, true);
  document.getElementById('sub-delta').textContent = wkDelta >= 0 ? 'ahead of target' : 'behind target';
  document.getElementById('stat-delta').className  = 'stat ' + (wkDelta >= 0 ? 'positive' : 'negative');

  const todayDay = days.find(d => d.date === now);
  if (todayDay) {
    const tw = workedHours(todayDay.punches);
    const td = tw - DAY_TARGET;
    document.getElementById('val-today').textContent = fmtH(tw) || '0h';
    document.getElementById('sub-today').textContent = `${fmtH(td, true)} vs ${fmtH(DAY_TARGET)} target`;
    document.getElementById('stat-today').className  = 'stat ' + (td >= 0 ? 'positive' : 'negative');
  } else {
    document.getElementById('val-today').textContent = '—';
    document.getElementById('sub-today').textContent = 'no entry today';
    document.getElementById('stat-today').className  = 'stat neutral';
  }

  const overallBalance = balanceUpTo(days.length - 1);
  document.getElementById('val-balance').textContent = fmtH(overallBalance, true);
  document.getElementById('sub-balance').textContent = overallBalance >= 0 ? 'ahead overall' : 'behind overall';
  document.getElementById('stat-balance').className  = 'stat ' + (overallBalance >= 0 ? 'positive' : 'negative');

  // Update month badge dynamically
  const allMonths = [...new Set(days.map(d => d.date.slice(0, 7)))];
  if (allMonths.length === 1) {
    const [y, m] = allMonths[0].split('-');
    const name = new Date(y, m - 1).toLocaleString('en', { month: 'long' });
    document.getElementById('month-badge').textContent = `${name} ${y}`;
  } else if (allMonths.length > 1) {
    document.getElementById('month-badge').textContent = `${allMonths.length} months`;
  }
}
