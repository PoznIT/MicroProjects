import { useState, useRef } from 'react';
import {
  Box, Typography, Paper, TextField, Button, Autocomplete, CircularProgress,
  Chip, Table, TableBody, TableRow, TableCell, Stack, Alert,
} from '@mui/material';

// ── Value-investing rubric (unchanged) ──────────────────────────────────────
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
  if (score >= 70) return { score, verdict: 'Attractive', color: 'success' };
  if (score >= 45) return { score, verdict: 'Mixed', color: 'info' };
  return { score, verdict: 'Unattractive', color: 'error' };
}

// rating → MUI Chip color
const CHIP_COLOR = { good: 'success', ok: 'info', bad: 'error', na: 'default' };

export default function ValueScope() {
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState(null); // { severity, msg }
  const [analyzing, setAnalyzing] = useState(false);
  const [data, setData] = useState(null);

  const seqRef = useRef(0);
  const timerRef = useRef(null);

  function onInput(value, reason) {
    setInputValue(value);
    if (reason !== 'input') return;       // ignore programmatic resets on select
    clearTimeout(timerRef.current);
    if (value.trim().length < 1) { setOptions([]); setSearching(false); return; }
    setSearching(true);
    timerRef.current = setTimeout(() => runSearch(value.trim()), 250);
  }

  async function runSearch(q) {
    const seq = ++seqRef.current;
    try {
      const r = await fetch('/api/valuescope/search?q=' + encodeURIComponent(q));
      const j = await r.json();
      if (seq !== seqRef.current) return; // a newer query superseded this one
      setOptions(!r.ok || j.error ? [] : (j.results || []));
    } catch {
      if (seq === seqRef.current) setOptions([]);
    } finally {
      if (seq === seqRef.current) setSearching(false);
    }
  }

  function onPick(value) {
    if (!value) return;
    if (typeof value === 'string') { analyze(value); return; }   // freeSolo text
    setInputValue(value.symbol);
    analyze(value.symbol);
  }

  async function analyze(symbolOverride) {
    const symbol = (symbolOverride || inputValue).trim().toUpperCase();
    if (!symbol) { setStatus({ severity: 'error', msg: 'Search for a company or enter a ticker first.' }); return; }
    setAnalyzing(true);
    setData(null);
    setStatus({ severity: 'info', msg: 'Fetching fundamentals for ' + symbol + '…' });
    try {
      const r = await fetch('/api/valuescope/metrics?symbol=' + encodeURIComponent(symbol));
      const j = await r.json();
      if (!r.ok || j.error) { setStatus({ severity: 'error', msg: j.error || 'Could not fetch data.' }); return; }
      setStatus(null);
      setData(j);
    } catch {
      setStatus({ severity: 'error', msg: 'Network error — please retry.' });
    } finally {
      setAnalyzing(false);
    }
  }

  const M = data?.metrics || {};
  const scoring = data ? computeScore(M) : null;
  const sub = data ? [data.sector, data.industry].filter(Boolean).join(' · ') : '';

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 12, px: 2, pb: 4 }}>
      <Typography variant="h4" fontWeight={700}>
        Value<Box component="span" sx={{ color: 'primary.main' }}>Scope</Box>
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        fundamental metrics & a quick value-investing read for any ticker
      </Typography>

      <Stack spacing={1.5} sx={{ width: '100%', maxWidth: 480 }}>
        <Autocomplete
          freeSolo
          options={options}
          loading={searching}
          filterOptions={(x) => x}                 // server-side results, no client filter
          inputValue={inputValue}
          onInputChange={(e, v, reason) => onInput(v, reason)}
          onChange={(e, v) => onPick(v)}
          getOptionLabel={(o) => (typeof o === 'string' ? o : o.symbol)}
          isOptionEqualToValue={(o, v) => o.symbol === v.symbol}
          noOptionsText="No matching companies found."
          renderOption={(props, o) => (
            <Box component="li" {...props} key={o.symbol}>
              <Typography sx={{ fontWeight: 600, minWidth: 64 }}>{o.symbol}</Typography>
              <Typography variant="body2" color="text.secondary" noWrap sx={{ flex: 1, mx: 1 }}>{o.name}</Typography>
              <Typography variant="caption" color="text.disabled">{o.exchange}</Typography>
            </Box>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Search company or ticker — e.g. Apple or AAPL"
              onKeyDown={(e) => { if (e.key === 'Enter' && inputValue.trim()) analyze(); }}
              slotProps={{
                input: {
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {searching ? <CircularProgress color="inherit" size={18} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                },
              }}
            />
          )}
        />
        <Button variant="contained" size="large" onClick={() => analyze()}>Analyze</Button>
      </Stack>

      {status && <Alert severity={status.severity} variant="outlined" sx={{ mt: 2, width: '100%', maxWidth: 480 }}
        icon={status.severity === 'info' && analyzing ? <CircularProgress size={18} /> : undefined}>{status.msg}</Alert>}

      {data && scoring && (
        <Box sx={{ width: '100%', maxWidth: 860, mt: 3 }}>
          <Paper variant="outlined" sx={{ p: 3, mb: 2, display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Typography variant="h5" fontWeight={700}>{data.symbol}</Typography>
              <Typography variant="body2">{data.name}</Typography>
              <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
                {sub}{sub ? <br /> : null}Market cap {fmtMoney(data.marketCap, data.currency)}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="overline" color="text.secondary">Price</Typography>
              <Typography variant="h6">{fmtMoney(data.price, data.currency)}</Typography>
            </Box>
            <Stack alignItems="center" spacing={0.5}>
              <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                <CircularProgress variant="determinate" value={scoring.score} size={88} thickness={4} color={scoring.color} />
                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="h5" color={`${scoring.color}.main`} fontWeight={700} lineHeight={1}>{scoring.score}</Typography>
                  <Typography variant="caption" color="text.secondary">/ 100</Typography>
                </Box>
              </Box>
              <Chip size="small" color={scoring.color} label={scoring.verdict} />
            </Stack>
          </Paper>

          {GROUPS.map(g => (
            <Box key={g.title} sx={{ mb: 2 }}>
              <Typography variant="overline" color="text.secondary" sx={{ pl: 0.5 }}>{g.title}</Typography>
              <Paper variant="outlined">
                <Table size="small">
                  <TableBody>
                    {g.items.map(m => {
                      const r = rate(M[m.key], m);
                      return (
                        <TableRow key={m.key}>
                          <TableCell sx={{ fontWeight: 600, width: 140 }}>{m.label}</TableCell>
                          <TableCell sx={{ width: 96 }}>
                            <Chip size="small" variant="outlined" color={CHIP_COLOR[r]} label={fmtVal(M[m.key], m)} />
                          </TableCell>
                          <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>{m.note}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Paper>
            </Box>
          ))}

          <Typography variant="caption" color="text.disabled" component="p" sx={{ mt: 1 }}>
            Color coding compares each metric against common value-investing rules of thumb
            (green = favorable, blue = acceptable, red = caution, grey = no data). Thresholds are
            generic and ignore sector context. Informational only — not investment advice.
          </Typography>
        </Box>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ mt: 'auto', pt: 6 }}>
        PoznIT / MicroProjects
      </Typography>
    </Box>
  );
}
