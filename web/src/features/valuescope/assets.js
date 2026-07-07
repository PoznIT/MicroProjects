// Shared mapping from a symbol's asset class (yfinance `quoteType`) to a small
// icon + label, so the search results, watchlist and detail card all render the
// same visual cue for what kind of instrument a symbol is.
import { faBuilding, faLayerGroup, faChartPie } from '@fortawesome/free-solid-svg-icons';

// key: normalized (upper-case) asset type → how to present it.
const KINDS = {
  ETF:        { icon: faLayerGroup, label: 'ETF',   title: 'Exchange-traded fund' },
  MUTUALFUND: { icon: faChartPie,   label: 'Fund',  title: 'Mutual fund' },
  EQUITY:     { icon: faBuilding,   label: 'Stock', title: 'Individual company (equity)' },
};

const DEFAULT = { icon: faBuilding, label: 'Stock', title: 'Individual company (equity)' };

// Resolve a raw type string to its presentation. Unknown / missing → equity.
export function assetKind(type) {
  return KINDS[(type || '').toUpperCase()] || DEFAULT;
}

// True when the instrument is a fund (ETF or mutual fund) rather than a single
// company — handy for callers that want to branch on "is this a basket".
export function isFund(type) {
  const t = (type || '').toUpperCase();
  return t === 'ETF' || t === 'MUTUALFUND';
}
