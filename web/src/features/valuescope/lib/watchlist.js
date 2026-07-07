// Pure helpers behind the watchlist panel: local-storage keys, list/entry
// shaping, entry sorting and scoring. No React — the stateful glue lives in
// hooks/useWatchlists.js, the markup in components/watchlist/.
import { computeScore } from './score.js';

// [{ id, name, open, sortKey, sortDir, items: [{symbol,name,type,score,verdict,color}] }]
export const LS_LISTS = 'vs-watchlists';
export const LS_PANEL = 'vs-panel-open'; // 'true' | 'false'

// Field sorts for the entries within a single list. sortKey === null keeps the
// order symbols were added in; otherwise entries are sorted (non-destructively)
// for display only — the stored array order is never mutated.
export const SORTS = {
  score:  { label: 'Score',  cmp: (a, b) => (a.score ?? -Infinity) - (b.score ?? -Infinity) },
  symbol: { label: 'Symbol', cmp: (a, b) => (a.symbol || '').localeCompare(b.symbol || '') },
  name:   { label: 'Name',   cmp: (a, b) => (a.name || '').localeCompare(b.name || '') },
};

export function sortedItems(list) {
  const conf = SORTS[list.sortKey];
  if (!conf) return list.items;
  const out = [...list.items].sort(conf.cmp);
  return list.sortDir === 'desc' ? out.reverse() : out;
}

export function loadLists() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_LISTS));
    if (Array.isArray(raw)) return raw;
  } catch { /* ignore corrupt state */ }
  return [];
}

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// Build a stored watchlist item from a full /metrics response.
export function toItem(data) {
  const s = computeScore(data.metrics || {}, data.type);
  return { symbol: data.symbol, name: data.name, type: data.type, score: s.score, verdict: s.verdict, color: s.color };
}
