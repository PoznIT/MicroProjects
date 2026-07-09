// Turns the /history payload into per-metric, per-range chart series.
//
// Two grades of data (see backend history.py):
//   price / priceInv metrics — reconstructed from the dense daily price line by
//     scaling today's multiple with the price ratio (an approximation that holds
//     per-share fundamentals constant).
//   statement metrics — real but sparse {t, v} points at fiscal period ends.

export const RANGES = [
  { key: '1M', label: '1M', days: 31 },
  { key: '6M', label: '6M', days: 186 },
  { key: '1Y', label: '1Y', days: 366 },
  { key: '3Y', label: '3Y', days: 1097 },
  { key: '5Y', label: '5Y', days: 1827 },
];

// Statement series need at least this many points inside a range to be worth
// plotting — a lone dot isn't an "evolution".
const MIN_STATEMENT_POINTS = 2;

function cutoffISO(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function inRange(points, days) {
  const cutoff = cutoffISO(days);
  return points.filter((p) => p.t >= cutoff);
}

// Latest close in the price line, used as the "now" anchor for reconstruction.
function priceNow(history) {
  const p = history?.price;
  return p && p.length ? p[p.length - 1].c : null;
}

// The raw close series [{t, c}] clipped to a range — the position price chart
// plots this directly (no metric reconstruction involved).
export function priceSeries(history, rangeDays) {
  return inRange(history?.price || [], rangeDays);
}

// X-axis tick label for a chart date, coarser as the range widens.
export function tickDate(t, rangeDays) {
  const d = new Date(t + 'T00:00:00');
  if (rangeDays <= 186) {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  if (rangeDays <= 1097) {
    return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  }
  return String(d.getFullYear());
}

// The series for one metric at one range, as [{ t, v }] sorted ascending.
export function buildSeries(metric, rangeDays, history, currentValue) {
  if (!history) return [];

  if (metric.hist === 'price' || metric.hist === 'priceInv') {
    if (currentValue === null || currentValue === undefined) return [];
    const now = priceNow(history);
    if (!now) return [];
    const inv = metric.hist === 'priceInv';
    return inRange(history.price || [], rangeDays).map((p) => ({
      t: p.t,
      v: inv ? currentValue * (now / p.c) : currentValue * (p.c / now),
    }));
  }

  const points = history.statements?.[metric.key] || [];
  return inRange(points, rangeDays);
}

// Whether a range is meaningful for a metric — drives which toggle buttons are
// enabled (e.g. ROE has no 1M/6M data, so those stay disabled).
export function rangeEnabled(metric, rangeDays, history, currentValue) {
  if (!history) return false;

  if (metric.hist === 'price' || metric.hist === 'priceInv') {
    if (currentValue === null || currentValue === undefined) return false;
    return inRange(history.price || [], rangeDays).length >= 2;
  }

  const points = history.statements?.[metric.key] || [];
  return inRange(points, rangeDays).length >= MIN_STATEMENT_POINTS;
}

// Whether the metric has any history at all (any range enabled) — decides if the
// row is expandable.
export function hasHistory(metric, history, currentValue) {
  return RANGES.some((r) => rangeEnabled(metric, r.days, history, currentValue));
}

// Smallest enabled range, so an expanded metric opens on something with data.
export function defaultRange(metric, history, currentValue) {
  const r = RANGES.find((rg) => rangeEnabled(metric, rg.days, history, currentValue));
  return r ? r.days : RANGES[RANGES.length - 1].days;
}
