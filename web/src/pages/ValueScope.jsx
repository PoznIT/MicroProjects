import { useState, useRef, useCallback } from 'react';
import './ValueScope.css';

// ── Value-investing rubric (ported verbatim from the original app) ──────────
const GROUPS = [
  { title: 'Valuation', items: [
    { key: 'trailingPE',  label: 'P/E (TTM)',  dir: 'low',  good: 15,   ok: 25,   fmt: 'x', note: 'Price vs. earnings. <15 is classically cheap.' },
    { key: 'forwardPE',   label: 'Fwd P/E',    dir: 'low',  good: 15,   ok: 25,   fmt: 'x', note: 'Price vs. expected earnings.' },
    { key: 'priceToBook', label: 'P/B',        dir: 'low',  good: 1.5,  ok: 3,    fmt: 'x', note: 'Price vs. book value. <1.5 favored by Graham.' },
    { key: 'pegRatio',    label: 'PEG',        dir: 'low',  good: 1,    ok: 2,    fmt: 'x', note: 'P/E adjusted for growth. <1 is attractive.' },
  ]},
  { title: 'Profitability', items: [
    { key: 'returnOnEquity', label: 'ROE',        dir: 'high', good: 0.15, ok: 0.08, fmt: '%', note: 'Return on shareholder equity. >15% is strong.' },
    { key: 'returnOnAssets', label: 'ROA',        dir: 'high', good: 0.07, ok: 0.03, fmt: '%', note: 'How efficiently assets generate profit.' },
    { key: 'profitMargins',  label: 'Net Margin', dir: 'high', good: 0.15, ok: 0.05, fmt: '%', note: 'Profit per dollar of revenue.' },
  ]},
  { title: 'Financial Health', items: [
    { key: 'debtToEquity', label: 'Debt / Equity', dir: 'low',  good: 0.5, ok: 1.0, fmt: 'x', note: 'Leverage. <0.5x is conservative.' },
    { key: 'currentRatio', label: 'Current Ratio', dir: 'high', good: 2,   ok: 1,   fmt: 'x', note: 'Short-term assets vs. liabilities. >2 is safe.' },
  ]},
  { title: 'Cash & Dividends', items: [
    { key: 'freeCashflowYield', label: 'FCF Yield', dir: 'high', good: 0.06, ok: 0.03, fmt: '%', note: 'Free cash flow vs. market cap. >6% is rich.' },
    { key: 'dividendYield',     label: 'Div Yield', dir: 'high', good: 0.03, ok: 0.01, fmt: '%', optional: true, note: 'Cash returned to holders. Optional for value.' },
  ]},
  { title: 'Growth', items: [
    { key: 'revenueGrowth',  label: 'Revenue Growth',  dir: 'high', good: 0.10, ok: 0.03, fmt: '%', note: 'Year-over-year revenue change.' },
    { key: 'earningsGrowth', label: 'Earnings Growth', dir: 'high', good: 0.10, ok: 0,    fmt: '%', note: 'Year-over-year earnings change.' },
  ]},
];

function rate(val, m) {
  if (val === null || val === undefined) return 'na';
  if (m.dir === 'low' && val <= 0) return 'bad';
  if (m.dir === 'low') return val <= m.good ? 'good' : (val <= m.ok ? 'ok' : 'bad');
  return val >= m.good ? 'good' : (val >= m.ok ? 'ok' : 'bad');
}
function fmtVal(val, m) {
  if (val === null || val === undefined) return '—';
  if (m.fmt === '%') return (val * 100).toFixed(1) + '%';
  if (m.fmt === 'x') return val.toFixed(2) + '×';
  return String(val);
}
function fmtMoney(n, cur) {
  if (n === null || n === undefined) return '—';
  const sign = cur === 'USD' ? '$' : (cur ? cur + ' ' : '');
  const abs = Math.abs(n);
  if (abs >= 1e12) return sign + (n / 1e12).toFixed(2) + 'T';
  if (abs >= 1e9)  return sign + (n / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6)  return sign + (n / 1e6).toFixed(2) + 'M';
  return sign + n.toFixed(2);
}

function computeScore(metrics) {
  let pts = 0, max = 0;
  GROUPS.forEach(g => g.items.forEach(m => {
    const r = rate(metrics[m.key], m);
    if (r === 'na') return;
    if (m.optional && r === 'bad') return;
    max += 2;
    pts += (r === 'good' ? 2 : r === 'ok' ? 1 : 0);
  }));
  const score = max ? Math.round((pts / max) * 100) : 0;
  let verdict, color;
  if (score >= 70)      { verdict = 'Attractive';   color = 'var(--accent)'; }
  else if (score >= 45) { verdict = 'Mixed';        color = 'var(--blue)'; }
  else                  { verdict = 'Unattractive'; color = 'var(--red)'; }
  return { score, verdict, color };
}

export default function ValueScope() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [status, setStatus] = useState({ msg: '', cls: '' });
  const [analyzing, setAnalyzing] = useState(false);
  const [data, setData] = useState(null);

  const seqRef = useRef(0);
  const timerRef = useRef(null);

  const closeSuggest = useCallback(() => {
    seqRef.current++;          // cancel ownership of any in-flight request
    setSearching(false);
    setOpen(false);
    setActiveIdx(-1);
  }, []);

  function onInput(v) {
    setQuery(v);
    clearTimeout(timerRef.current);
    if (v.trim().length < 1) { closeSuggest(); return; }
    timerRef.current = setTimeout(() => runSearch(v.trim()), 250);
  }

  async function runSearch(q) {
    const seq = ++seqRef.current;
    setSearching(true);
    setSuggestions([]);
    setActiveIdx(-1);
    setOpen(true);
    try {
      const r = await fetch('/api/valuescope/search?q=' + encodeURIComponent(q));
      const j = await r.json();
      if (seq !== seqRef.current) return;   // a newer request owns the UI
      setSearching(false);
      if (!r.ok || j.error) { setOpen(false); return; }
      setSuggestions(j.results || []);
    } catch {
      if (seq === seqRef.current) { setSearching(false); setOpen(false); }
    }
  }

  function pick(item) {
    if (!item) return;
    setQuery(item.symbol);
    closeSuggest();
    analyze(item.symbol);
  }

  function onKeyDown(e) {
    if (!open || !suggestions.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => {
        let n = i + (e.key === 'ArrowDown' ? 1 : -1);
        if (n < 0) n = suggestions.length - 1;
        if (n >= suggestions.length) n = 0;
        return n;
      });
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      pick(suggestions[activeIdx]);
    } else if (e.key === 'Escape') {
      closeSuggest();
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    if (activeIdx >= 0 && suggestions[activeIdx]) { pick(suggestions[activeIdx]); return; }
    closeSuggest();
    analyze();
  }

  async function analyze(symbolOverride) {
    const symbol = (symbolOverride || query).trim().toUpperCase();
    if (!symbol) { setStatus({ msg: 'Search for a company or enter a ticker first.', cls: 'err' }); return; }
    setAnalyzing(true);
    setData(null);
    setStatus({ msg: 'Fetching fundamentals for ' + symbol + '…', cls: 'work' });
    try {
      const r = await fetch('/api/valuescope/metrics?symbol=' + encodeURIComponent(symbol));
      const j = await r.json();
      if (!r.ok || j.error) { setStatus({ msg: j.error || 'Could not fetch data.', cls: 'err' }); return; }
      setStatus({ msg: '', cls: '' });
      setData(j);
    } catch {
      setStatus({ msg: 'Network error — please retry.', cls: 'err' });
    } finally {
      setAnalyzing(false);
    }
  }

  const M = data?.metrics || {};
  const scoring = data ? computeScore(M) : null;
  const R = 40, C = 2 * Math.PI * R;

  return (
    <div className="page vs">
      <div className="logo">Value<span>Scope</span></div>
      <div className="tagline">fundamental metrics &amp; a quick value-investing read for any ticker</div>

      <form className="search" onSubmit={onSubmit} autoComplete="off">
        <div className={'combo' + (searching ? ' loading' : '')}>
          <input value={query} onChange={e => onInput(e.target.value)} onKeyDown={onKeyDown}
                 maxLength={64} spellCheck="false" autoComplete="off"
                 placeholder="Search company or ticker — e.g. Apple or AAPL" />
          <span className="in-spin" aria-hidden="true" />
          {open && (
            <div className="suggest open" role="listbox">
              {searching ? (
                <div className="sug-loading"><span className="spinner" />Searching…</div>
              ) : suggestions.length === 0 ? (
                <div className="sug-empty">No matching companies found.</div>
              ) : suggestions.map((it, i) => (
                <div key={it.symbol} className={'sug-item' + (i === activeIdx ? ' active' : '')}
                     role="option" onMouseDown={e => { e.preventDefault(); pick(it); }}>
                  <span className="s">{it.symbol}</span>
                  <span className="n">{it.name}</span>
                  <span className="x">{it.exchange}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <button className="btn-go" type="submit">Analyze</button>
      </form>

      <div className={'status ' + status.cls}>
        {analyzing && <span className="spinner" />}{status.msg}
      </div>

      {data && scoring && (
        <div className="dash">
          <div className="head">
            <div className="id">
              <div className="sym">{data.symbol}</div>
              <div className="nm">{data.name}</div>
              <div className="sub">
                {[data.sector, data.industry].filter(Boolean).join(' · ')}
                {(data.sector || data.industry) && <br />}
                Market cap {fmtMoney(data.marketCap, data.currency)}
              </div>
            </div>
            <div className="px">
              <div className="l">Price</div>
              <div className="v">{fmtMoney(data.price, data.currency)}</div>
            </div>
            <div className="score-wrap">
              <div className="ring">
                <svg width="92" height="92" viewBox="0 0 92 92">
                  <circle className="track" cx="46" cy="46" r={R} fill="none" strokeWidth="8" />
                  <circle cx="46" cy="46" r={R} fill="none" stroke={scoring.color} strokeWidth="8"
                          strokeLinecap="round" strokeDasharray={`${(scoring.score / 100) * C} ${C}`}
                          transform="rotate(-90 46 46)" />
                </svg>
                <div className="val-num">
                  <b style={{ color: scoring.color }}>{scoring.score}</b><s>/ 100</s>
                </div>
              </div>
              <div className="verdict" style={{ color: scoring.color }}>{scoring.verdict}</div>
            </div>
          </div>

          {GROUPS.map(g => (
            <div className="group" key={g.title}>
              <div className="group-title">{g.title}</div>
              <div className="cards">
                {g.items.map(m => (
                  <div className={'metric ' + rate(M[m.key], m)} key={m.key}>
                    <div className="k">{m.label}</div>
                    <div className="v">{fmtVal(M[m.key], m)}</div>
                    <div className="t">{m.note}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="disclaimer">
            Color coding compares each metric against common value-investing rules of thumb
            (green = favorable, blue = acceptable, red = caution, grey = no data). Thresholds are
            generic and ignore sector context. Informational only — not investment advice.
          </div>
        </div>
      )}

      <footer className="footer">PoznIT / MicroProjects</footer>
    </div>
  );
}
