import { useEffect, useState } from 'react';
import { parseSession } from '../lib/session.js';
import {
  loadLists, newId, toItem, toHoldingItem, IBKR_LIST_NAME, LS_LISTS, LS_PANEL,
} from '../lib/watchlist.js';

// Everything stateful behind the watchlist panel: the lists themselves (created,
// renamed, reordered, sorted, persisted to localStorage), the docked pane's
// open/closed state, and the metrics fetching that (re)scores entries on refresh
// or session load. The panel components consume this and stay presentational.
export function useWatchlists() {
  const [lists, setLists] = useState(loadLists);
  const [panelOpen, setPanelOpen] = useState(() => localStorage.getItem(LS_PANEL) !== 'false');
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);
  const [newName, setNewName] = useState('');
  const [notice, setNotice] = useState(null); // { error, text }
  const [editing, setEditing] = useState(null); // { id, name } while renaming a list
  const [menu, setMenu] = useState(null);       // { anchorEl, id } for a list's actions menu
  const [resolving, setResolving] = useState(null); // { listId, item } while manually linking an unscored entry

  useEffect(() => { localStorage.setItem(LS_LISTS, JSON.stringify(lists)); }, [lists]);
  useEffect(() => { localStorage.setItem(LS_PANEL, String(panelOpen)); }, [panelOpen]);

  const totalItems = lists.reduce((n, l) => n + l.items.length, 0);

  function createList() {
    const name = newName.trim() || `Watchlist ${lists.length + 1}`;
    setLists(ls => [...ls, { id: newId(), name, open: true, sortKey: null, sortDir: 'asc', items: [] }]);
    setNewName('');
  }

  const deleteList = (id) => setLists(ls => ls.filter(l => l.id !== id));
  const toggleList = (id) => setLists(ls => ls.map(l => l.id === id ? { ...l, open: !l.open } : l));

  const renameList = (id, name) => setLists(ls => ls.map(l => l.id === id ? { ...l, name } : l));

  function commitRename() {
    if (!editing) return;
    const name = editing.name.trim();
    if (name) renameList(editing.id, name);
    setEditing(null);
  }

  // Swap a list with its neighbour to move it up (-1) or down (+1) in the panel.
  function moveList(id, dir) {
    setLists(ls => {
      const i = ls.findIndex(l => l.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ls.length) return ls;
      const next = [...ls];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  // Pick the field to sort a list's entries by; re-picking the active field
  // flips direction, and null restores the original "as added" order.
  function setSort(id, key) {
    setLists(ls => ls.map(l => {
      if (l.id !== id) return l;
      if (key === null) return { ...l, sortKey: null };
      if (l.sortKey === key) return { ...l, sortDir: l.sortDir === 'asc' ? 'desc' : 'asc' };
      return { ...l, sortKey: key, sortDir: key === 'score' ? 'desc' : 'asc' };
    }));
  }

  const removeItem = (id, symbol) =>
    setLists(ls => ls.map(l => l.id === id ? { ...l, items: l.items.filter(i => i.symbol !== symbol) } : l));

  function addCurrent(id, current) {
    if (!current) return;
    const item = toItem(current);
    setLists(ls => ls.map(l => {
      if (l.id !== id || l.items.some(i => i.symbol === item.symbol)) return l;
      return { ...l, items: [...l.items, item] };
    }));
  }

  // Fetch live metrics for a set of symbols and score them into watchlist items.
  async function fetchItems(symbols) {
    const out = {};
    await Promise.all(symbols.map(async (sym) => {
      try {
        const r = await fetch('/api/valuescope/metrics?symbol=' + encodeURIComponent(sym));
        const j = await r.json();
        if (r.ok && !j.error) out[sym] = toItem(j);
      } catch { /* leave the existing value in place */ }
    }));
    return out;
  }

  const applyItems = (updated) => setLists(ls => ls.map(l => ({
    ...l,
    items: l.items.map(it => updated[it.symbol] ? { ...it, ...updated[it.symbol] } : it),
  })));

  async function refreshAll() {
    const symbols = [...new Set(lists.flatMap(l => l.items.map(i => i.symbol)))];
    if (!symbols.length || refreshing) return;
    setRefreshing(true);
    applyItems(await fetchItems(symbols));
    setRefreshing(false);
  }

  // Manually re-point an unscored entry (typically an IBKR holding whose symbol
  // Yahoo couldn't resolve) at a real listing the user picked from search: swap
  // in the match's symbol/name/type, keep the position, then score it. toItem
  // omits position, so the follow-up scoring leaves the holding data intact.
  // Returns whether the swap actually happened, so callers (e.g. the position
  // page, which also moves the trade log) know whether to follow through.
  async function resolveItem(listId, oldSymbol, pick) {
    setResolving(null);
    const symbol = (pick?.symbol || '').trim().toUpperCase();
    if (!symbol) return false;
    const list = lists.find(l => l.id === listId);
    if (!list || !list.items.some(i => i.symbol === oldSymbol)) return false;
    if (symbol !== oldSymbol && list.items.some(i => i.symbol === symbol)) {
      setNotice({ error: true, text: `${symbol} is already in this list.` });
      return false;
    }
    setLists(ls => ls.map(l => l.id !== listId ? l : {
      ...l,
      items: l.items.map(it => it.symbol === oldSymbol
        ? { ...it, symbol, name: pick.name || symbol, type: pick.type || it.type }
        : it),
    }));
    setNotice({ error: false, text: `Linked ${oldSymbol} → ${symbol} — scoring…` });
    applyItems(await fetchItems([symbol]));
    setNotice({ error: false, text: `Linked ${oldSymbol} → ${symbol}.` });
    return true;
  }

  // Pull the account's open positions (and, when the Flex query carries them,
  // its executions — merged server-side into the trade log) from IBKR,
  // (re)build the "IBKR Holdings" list, then score each symbol through the
  // usual metrics pipeline. fetchItems returns plain scored items (no
  // position), so spreading them over the seeded holdings keeps each entry's
  // position intact.
  async function importFromIbkr() {
    if (importing || refreshing) return;
    setImporting(true);
    setNotice({ error: false, text: 'Fetching holdings from IBKR…' });
    try {
      const r = await fetch('/api/valuescope/ibkr/import', { method: 'POST' });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || 'Request failed');

      const positions = j.positions || [];
      if (!positions.length) {
        setNotice({ error: false, text: 'No open stock/ETF positions found in your IBKR account.' });
        return;
      }

      const seeded = positions.map(toHoldingItem);
      setLists(ls => [
        ...ls.filter(l => l.name !== IBKR_LIST_NAME),
        { id: newId(), name: IBKR_LIST_NAME, open: true, sortKey: null, sortDir: 'asc', items: seeded },
      ]);

      const asOf = j.asOf ? ` (as of ${j.asOf})` : '';
      const trades = j.tradesImported
        ? `, ${j.tradesImported} new trade(s)`
        : (j.tradesDuplicate ? ', no new trades' : '');
      const summary = `Imported ${positions.length} holding(s)${trades} from IBKR${asOf}`;
      setNotice({ error: false, text: `${summary} — scoring…` });
      applyItems(await fetchItems([...new Set(seeded.map(i => i.symbol))]));
      setNotice({ error: false, text: `${summary}.` });
    } catch (err) {
      setNotice({ error: true, text: 'IBKR import failed — ' + (err.message || 'unknown error.') });
    } finally {
      setImporting(false);
    }
  }

  // Import trades from an IBKR Flex Query CSV (the manual, full-history export
  // that isn't bound by the Flex Web Service's 365-day window). The file is read
  // client-side and POSTed as the raw body; the server dedupes rows by IBKR
  // trade ID against API imports and prior CSV imports, so nothing already in
  // the log re-imports. Trades land in the server-side log and surface on each
  // symbol's position page — no watchlist rebuild here.
  async function importCsv(e) {
    const file = e.target.files?.[0];
    e.target.value = '';                 // allow re-selecting the same file
    if (!file || importingCsv || importing) return;
    setImportingCsv(true);
    setNotice({ error: false, text: `Importing trades from ${file.name}…` });
    try {
      const text = await file.text();
      const r = await fetch('/api/valuescope/ibkr/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        body: text,
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || 'Request failed');
      const added = j.tradesImported
        ? `${j.tradesImported} new trade(s) imported`
        : 'no new trades (all already in your log)';
      const dup = j.tradesDuplicate ? `, ${j.tradesDuplicate} already present` : '';
      setNotice({ error: false, text: `CSV: ${added}${dup}. Log now holds ${j.tradesTotal} trade(s).` });
    } catch (err) {
      setNotice({ error: true, text: 'CSV import failed — ' + (err.message || 'unknown error.') });
    } finally {
      setImportingCsv(false);
    }
  }

  async function loadSession(e) {
    const file = e.target.files?.[0];
    e.target.value = '';                 // allow re-loading the same file
    if (!file) return;
    try {
      const loaded = parseSession(await file.text());
      setLists(ls => [...ls, ...loaded]);
      const symbols = [...new Set(loaded.flatMap(l => l.items.map(i => i.symbol)))];
      setNotice({ error: false, text:
        `Loaded ${loaded.length} list(s), ${symbols.length} symbol(s)${symbols.length ? ' — scoring…' : ''}` });
      if (symbols.length) {
        setRefreshing(true);
        applyItems(await fetchItems(symbols));
        setRefreshing(false);
        setNotice({ error: false, text: `Loaded ${loaded.length} list(s), ${symbols.length} symbol(s).` });
      }
    } catch (err) {
      setNotice({ error: true, text: 'Could not load — ' + (err.message || 'invalid file.') });
    }
  }

  return {
    lists, panelOpen, setPanelOpen, refreshing, importing, importingCsv, totalItems,
    newName, setNewName, notice, setNotice, editing, setEditing, menu, setMenu,
    resolving, setResolving,
    createList, deleteList, toggleList, commitRename, moveList, setSort,
    removeItem, addCurrent, refreshAll, importFromIbkr, importCsv, resolveItem, loadSession,
  };
}
