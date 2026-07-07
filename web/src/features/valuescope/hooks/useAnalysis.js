import { useRef, useState } from 'react';
import { computeScore } from '../lib/score.js';
import { isFund } from '../lib/assets.js';

// All the state and fetching behind the ValueScope page: the symbol search box,
// the analyze request that loads a symbol's metrics, and the lazy-loaded price
// history that backs the expandable metric charts. The page itself is left as
// pure markup that consumes this hook's return value.
export function useAnalysis() {
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState(null); // { severity, msg }
  const [analyzing, setAnalyzing] = useState(false);
  const [data, setData] = useState(null);
  const [expanded, setExpanded] = useState(null);   // metric key currently open
  const [history, setHistory] = useState(null);      // /history payload for `data`
  const [historyState, setHistoryState] = useState('idle'); // idle|loading|error|ready

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
    setExpanded(null);
    setHistory(null);
    setHistoryState('idle');
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

  // Lazy-load the historical series the first time any metric is expanded.
  async function loadHistory(symbol) {
    setHistoryState('loading');
    try {
      const r = await fetch('/api/valuescope/history?symbol=' + encodeURIComponent(symbol));
      const j = await r.json();
      if (!r.ok || j.error) { setHistoryState('error'); return; }
      setHistory(j);
      setHistoryState('ready');
    } catch {
      setHistoryState('error');
    }
  }

  function toggleMetric(key) {
    setExpanded((cur) => (cur === key ? null : key));
    if (history === null && historyState !== 'loading' && data) loadHistory(data.symbol);
  }

  // Derived view state — kept here so the page never recomputes scoring inline.
  const metrics = data?.metrics || {};
  const fund = data ? isFund(data.type) : false;
  const scoring = data ? computeScore(metrics, data.type) : null;
  const sub = data
    ? (fund ? [data.category, data.fundFamily] : [data.sector, data.industry]).filter(Boolean).join(' · ')
    : '';

  return {
    inputValue, options, searching, status, analyzing,
    data, expanded, history, historyState,
    metrics, fund, scoring, sub,
    onInput, onPick, analyze, toggleMetric,
  };
}
