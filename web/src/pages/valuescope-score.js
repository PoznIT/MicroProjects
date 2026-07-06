// Value-investing rubric + scoring, shared by the ValueScope page and the
// watchlist panel so both agree on how a symbol's score is computed.

// `hist` tells the graph view how to build a metric's time series:
//   'price'     — price-driven multiple; reconstruct as value_now × price(t)/now
//   'priceInv'  — price-in-denominator yield; reconstruct × now/price(t)
//   'statement' — real (sparse) points fetched from financial statements
export const GROUPS = [
  { title: 'Valuation', items: [
    { key: 'trailingPE',  label: 'P/E (TTM)',  dir: 'low',  good: 15,   ok: 25,   fmt: 'x', hist: 'price', note: 'Price vs. earnings. <15 is classically cheap.' },
    { key: 'forwardPE',   label: 'Fwd P/E',    dir: 'low',  good: 15,   ok: 25,   fmt: 'x', hist: 'price', note: 'Price vs. expected earnings.' },
    { key: 'priceToBook', label: 'P/B',        dir: 'low',  good: 1.5,  ok: 3,    fmt: 'x', hist: 'price', note: 'Price vs. book value. <1.5 favored by Graham.' },
    { key: 'pegRatio',    label: 'PEG',        dir: 'low',  good: 1,    ok: 2,    fmt: 'x', hist: 'price', note: 'P/E adjusted for growth. <1 is attractive.' },
  ]},
  { title: 'Profitability', items: [
    { key: 'returnOnEquity', label: 'ROE',        dir: 'high', good: 0.15, ok: 0.08, fmt: '%', hist: 'statement', note: 'Return on shareholder equity. >15% is strong.' },
    { key: 'returnOnAssets', label: 'ROA',        dir: 'high', good: 0.07, ok: 0.03, fmt: '%', hist: 'statement', note: 'How efficiently assets generate profit.' },
    { key: 'profitMargins',  label: 'Net Margin', dir: 'high', good: 0.15, ok: 0.05, fmt: '%', hist: 'statement', note: 'Profit per dollar of revenue.' },
  ]},
  { title: 'Financial Health', items: [
    { key: 'debtToEquity', label: 'Debt / Equity', dir: 'low',  good: 0.5, ok: 1.0, fmt: 'x', hist: 'statement', note: 'Leverage. <0.5x is conservative.' },
    { key: 'currentRatio', label: 'Current Ratio', dir: 'high', good: 2,   ok: 1,   fmt: 'x', hist: 'statement', note: 'Short-term assets vs. liabilities. >2 is safe.' },
  ]},
  { title: 'Cash & Dividends', items: [
    { key: 'freeCashflowYield', label: 'FCF Yield', dir: 'high', good: 0.06, ok: 0.03, fmt: '%', hist: 'priceInv', note: 'Free cash flow vs. market cap. >6% is rich.' },
    { key: 'dividendYield',     label: 'Div Yield', dir: 'high', good: 0.03, ok: 0.01, fmt: '%', hist: 'priceInv', optional: true, note: 'Cash returned to holders. Optional for value.' },
  ]},
  { title: 'Growth', items: [
    { key: 'revenueGrowth',  label: 'Revenue Growth',  dir: 'high', good: 0.10, ok: 0.03, fmt: '%', hist: 'statement', note: 'Year-over-year revenue change.' },
    { key: 'earningsGrowth', label: 'Earnings Growth', dir: 'high', good: 0.10, ok: 0,    fmt: '%', hist: 'statement', note: 'Year-over-year earnings change.' },
  ]},
];

export function rate(val, m) {
  if (val === null || val === undefined) return 'na';
  if (m.dir === 'low' && val <= 0) return 'bad';
  if (m.dir === 'low') return val <= m.good ? 'good' : (val <= m.ok ? 'ok' : 'bad');
  return val >= m.good ? 'good' : (val >= m.ok ? 'ok' : 'bad');
}

export function fmtVal(val, m) {
  if (val === null || val === undefined) return '—';
  if (m.fmt === '%') return (val * 100).toFixed(1) + '%';
  if (m.fmt === 'x') return val.toFixed(2) + '×';
  return String(val);
}

export function fmtMoney(n, cur) {
  if (n === null || n === undefined) return '—';
  const sign = cur === 'USD' ? '$' : (cur ? cur + ' ' : '');
  const abs = Math.abs(n);
  if (abs >= 1e12) return sign + (n / 1e12).toFixed(2) + 'T';
  if (abs >= 1e9)  return sign + (n / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6)  return sign + (n / 1e6).toFixed(2) + 'M';
  return sign + n.toFixed(2);
}

export function computeScore(metrics) {
  let pts = 0, max = 0;
  GROUPS.forEach(g => g.items.forEach(m => {
    const r = rate(metrics[m.key], m);
    if (r === 'na') return;
    if (m.optional && r === 'bad') return;
    max += 2;
    pts += (r === 'good' ? 2 : r === 'ok' ? 1 : 0);
  }));
  const score = max ? Math.round((pts / max) * 100) : 0;
  if (score >= 70) return { score, verdict: 'Attractive', color: 'success' };
  if (score >= 45) return { score, verdict: 'Mixed', color: 'info' };
  return { score, verdict: 'Unattractive', color: 'error' };
}

// rating → MUI Chip color
export const CHIP_COLOR = { good: 'success', ok: 'info', bad: 'error', na: 'default' };
