import { useEffect, useState } from 'react';
import { parseSession } from '../lib/session.js';
import {
  loadLists, newId, toItem, LS_LISTS, LS_PANEL,
} from '../lib/watchlist.js';

// Everything stateful behind the watchlist panel: the lists themselves (created,
// renamed, reordered, sorted, persisted to localStorage), the docked pane's
// open/closed state, and the metrics fetching that (re)scores entries on refresh
// or session load. The panel components consume this and stay presentational.
export function useWatchlists() {
  const [lists, setLists] = useState(loadLists);
  const [panelOpen, setPanelOpen] = useState(() => localStorage.getItem(LS_PANEL) !== 'false');
  const [refreshing, setRefreshing] = useState(false);
  const [newName, setNewName] = useState('');
  const [notice, setNotice] = useState(null); // { error, text }
  const [editing, setEditing] = useState(null); // { id, name } while renaming a list
  const [menu, setMenu] = useState(null);       // { anchorEl, id } for a list's actions menu

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
    lists, panelOpen, setPanelOpen, refreshing, totalItems,
    newName, setNewName, notice, setNotice, editing, setEditing, menu, setMenu,
    createList, deleteList, toggleList, commitRename, moveList, setSort,
    removeItem, addCurrent, refreshAll, loadSession,
  };
}
