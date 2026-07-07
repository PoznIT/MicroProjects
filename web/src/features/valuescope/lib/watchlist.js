// Pure helpers behind the watchlist panel: local-storage keys, list/entry
// shaping, entry sorting and scoring. No React — the stateful glue lives in
// hooks/useWatchlists.js, the markup in components/watchlist/.
import { computeScore } from './score.js';

// [{ id, name, open, sortKey, sortDir, items: [{symbol,name,type,score,verdict,color,position?}] }]
// A holding item additionally carries position: { quantity, avgCost, currency }.
export const LS_LISTS = 'vs-watchlists';
export const LS_PANEL = 'vs-panel-open'; // 'true' | 'false'

// The single list the IBKR import owns — re-importing replaces it in place.
export const IBKR_LIST_NAME = 'IBKR Holdings';

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

// Seed a watchlist item from one IBKR holding, before it's scored. Name/type
// are placeholders that the follow-up /metrics scoring fills in; the position
// is what makes this a "holding" (and survives scoring, since toItem omits it).
export function toHoldingItem(h) {
  return {
    symbol: h.symbol,
    name: h.symbol,
    type: h.assetCategory === 'ETF' ? 'ETF' : 'EQUITY',
    score: null, verdict: null, color: 'default',
    position: { quantity: h.quantity, avgCost: h.avgCost, currency: h.currency },
  };
}

// Compact "42 sh · avg $178.20" line for a holding's position. USD gets a $;
// other currencies show their code so the number is never ambiguous.
export function fmtPosition(pos) {
  if (!pos) return '';
  const qty = Number(pos.quantity);
  const shares = Number.isFinite(qty)
    ? qty.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '—';
  let out = `${shares} sh`;
  if (pos.avgCost != null) {
    const cost = Number(pos.avgCost).toLocaleString(undefined,
      { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    out += pos.currency === 'USD' || !pos.currency
      ? ` · avg $${cost}` : ` · avg ${cost} ${pos.currency}`;
  }
  return out;
}
