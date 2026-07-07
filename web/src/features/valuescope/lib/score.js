// Value-investing rubric + scoring, shared by the ValueScope page and the
// watchlist panel so both agree on how a symbol's score is computed.
import { isFund } from './assets.js';

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

// A fund has no income statement or balance sheet, so the equity rubric above
// comes back empty. Funds are judged on what actually matters for a basket:
// cost (the one persistent driver of net return), income, trailing performance,
// risk and portfolio character. Metrics without a `dir` are informational —
// they render a value + grey chip but don't feed the score. `weight` lets cost
// dominate the score the way it dominates a fund's long-run outcome.
export const ETF_GROUPS = [
  { title: 'Cost', items: [
    { key: 'expenseRatio', label: 'Expense Ratio', dir: 'low', good: 0.0020, ok: 0.0050, weight: 3, fmt: 'pct2', note: 'Annual fee drag. <0.20% is cheap — the top value lever for a fund.' },
  ]},
  { title: 'Income', items: [
    { key: 'distributionYield', label: 'Distribution Yield', dir: 'high', good: 0.02, ok: 0.005, optional: true, fmt: '%', note: 'Trailing income paid to holders. Optional — growth funds pay little.' },
  ]},
  { title: 'Performance', items: [
    { key: 'ytdReturn',       label: 'YTD Return',  fmt: '%', note: 'Return so far this year. Informational — seasonal, not annualized.' },
    { key: 'threeYearReturn', label: '3-Yr Return', dir: 'high', good: 0.10, ok: 0.04, fmt: '%', note: 'Annualized total return over 3 years.' },
    { key: 'fiveYearReturn',  label: '5-Yr Return', dir: 'high', good: 0.08, ok: 0.03, fmt: '%', note: 'Annualized total return over 5 years.' },
  ]},
  { title: 'Risk & Pricing', items: [
    { key: 'beta3Y',          label: 'Beta (3Y)',       fmt: 'num',  note: 'Volatility vs. the market. ~1.0 moves with it; >1 is punchier.' },
    { key: 'premiumDiscount', label: 'Premium / Disc.', fmt: 'pct2', note: 'Market price vs. NAV. Near 0% is healthy; large premiums are a caution.' },
  ]},
  { title: 'Portfolio', items: [
    { key: 'portfolioPE', label: 'Weighted P/E', fmt: 'num', note: 'Aggregate P/E of holdings. Equity funds only.' },
    { key: 'portfolioPB', label: 'Weighted P/B', fmt: 'num', note: 'Aggregate P/B of holdings. Equity funds only.' },
  ]},
];

// Which rubric applies to a symbol, by asset class.
export function groupsFor(type) {
  return isFund(type) ? ETF_GROUPS : GROUPS;
}

export function rate(val, m) {
  if (val === null || val === undefined) return 'na';
  if (!m.dir) return 'na';                 // informational metric — value only, no rating
  if (m.dir === 'low' && val <= 0) return 'bad';
  if (m.dir === 'low') return val <= m.good ? 'good' : (val <= m.ok ? 'ok' : 'bad');
  return val >= m.good ? 'good' : (val >= m.ok ? 'ok' : 'bad');
}

export function fmtVal(val, m) {
  if (val === null || val === undefined) return '—';
  if (m.fmt === '%') return (val * 100).toFixed(1) + '%';
  if (m.fmt === 'pct2') return (val * 100).toFixed(2) + '%';   // fine-grained % (e.g. expense ratio)
  if (m.fmt === 'x') return val.toFixed(2) + '×';
  if (m.fmt === 'num') return val.toFixed(2);
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

export function computeScore(metrics, type) {
  let pts = 0, max = 0;
  groupsFor(type).forEach(g => g.items.forEach(m => {
    const r = rate(metrics[m.key], m);      // informational metrics rate 'na' and are skipped
    if (r === 'na') return;
    if (m.optional && r === 'bad') return;
    const w = m.weight || 1;
    max += 2 * w;
    pts += (r === 'good' ? 2 : r === 'ok' ? 1 : 0) * w;
  }));
  const score = max ? Math.round((pts / max) * 100) : 0;
  if (score >= 70) return { score, verdict: 'Attractive', color: 'success' };
  if (score >= 45) return { score, verdict: 'Mixed', color: 'info' };
  return { score, verdict: 'Unattractive', color: 'error' };
}

// rating → MUI Chip color
export const CHIP_COLOR = { good: 'success', ok: 'info', bad: 'error', na: 'default' };
