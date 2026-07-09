import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildPerformance } from '../lib/trades.js';

// Everything the position detail view needs for one symbol: the daily price
// history (chart backbone + current price), the trade log from the backend
// store, and the FIFO performance model derived from the two. Also the
// add/edit/delete mutations — each round-trips to the API then refetches the
// log, so the server file stays the single source of truth.
export function usePosition(symbol) {
  const [history, setHistory] = useState(null);
  const [historyState, setHistoryState] = useState('loading'); // loading|error|ready
  const [trades, setTrades] = useState([]);
  const [tradesState, setTradesState] = useState('loading');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null); // mutation failures, shown inline

  const loadTrades = useCallback(async () => {
    try {
      const r = await fetch('/api/valuescope/trades?symbol=' + encodeURIComponent(symbol));
      const j = await r.json();
      if (!r.ok || j.error) { setTradesState('error'); return; }
      setTrades(j.trades || []);
      setTradesState('ready');
    } catch {
      setTradesState('error');
    }
  }, [symbol]);

  useEffect(() => {
    let stale = false;
    setHistory(null);
    setHistoryState('loading');
    setTrades([]);
    setTradesState('loading');
    setError(null);

    (async () => {
      try {
        const r = await fetch('/api/valuescope/history?symbol=' + encodeURIComponent(symbol));
        const j = await r.json();
        if (stale) return;
        if (!r.ok || j.error) { setHistoryState('error'); return; }
        setHistory(j);
        setHistoryState('ready');
      } catch {
        if (!stale) setHistoryState('error');
      }
    })();
    loadTrades();

    return () => { stale = true; };
  }, [symbol, loadTrades]);

  const price = history?.price;
  const currentPrice = price && price.length ? price[price.length - 1].c : null;

  const performance = useMemo(
    () => buildPerformance(trades, currentPrice),
    [trades, currentPrice],
  );

  // One shape for all three mutations: hit the API, surface {error}, refetch.
  const mutate = useCallback(async (url, options) => {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(url, options);
      const j = await r.json();
      if (!r.ok || j.error) { setError(j.error || 'Request failed.'); return false; }
      await loadTrades();
      return true;
    } catch {
      setError('Network error — please retry.');
      return false;
    } finally {
      setSaving(false);
    }
  }, [loadTrades]);

  const jsonReq = (method, body) => ({
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });

  const addTrade = (payload) =>
    mutate('/api/valuescope/trades', jsonReq('POST', { ...payload, symbol }));
  const updateTrade = (id, payload) =>
    mutate('/api/valuescope/trades/' + encodeURIComponent(id), jsonReq('PUT', { ...payload, symbol }));
  const deleteTrade = (id) =>
    mutate('/api/valuescope/trades/' + encodeURIComponent(id), { method: 'DELETE' });

  return {
    history, historyState, trades, tradesState, currentPrice,
    performance, saving, error, setError,
    addTrade, updateTrade, deleteTrade,
  };
}
