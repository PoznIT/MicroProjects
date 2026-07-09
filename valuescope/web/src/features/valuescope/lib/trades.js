// Per-trade performance model: FIFO lot matching over a symbol's trade log.
// Pure data-in/data-out (no React, no MUI) so it stays testable and portable —
// see trades.test.js, run with `node --test`.
//
// A trade is {id, date: 'YYYY-MM-DD', time?: 'HH:MM:SS', side: 'BUY'|'SELL',
// quantity (>0), price, commission}. BUYs open lots; SELLs consume the oldest
// lots first (FIFO — IBKR's own default), each match producing one closed
// trade with its own return. What's left over are the open lots, judged
// against the current price. Commissions are folded into cost basis (buys)
// and taken out of proceeds (sells), pro-rata per share, so partial fills and
// fractional shares need no special casing.

const EPS = 1e-9;

function tradeOrder(a, b) {
  return (a.date || '').localeCompare(b.date || '')
    || (a.time || '').localeCompare(b.time || '')
    || (a.id || '').localeCompare(b.id || '');
}

const pct = (gain, basis) => (basis > EPS ? gain / basis : null);

// The full performance picture for one symbol.
// Returns { openLots, closed, summary, warnings }:
//   openLots — [{ id, date, quantity, unitCost, costBasis, unrealizedAbs,
//                 unrealizedPct }] oldest first (unrealized* null w/o price)
//   closed   — [{ entryId, exitId, entryDate, exitDate, quantity,
//                 entryUnitCost, exitUnitProceeds, gainAbs, returnPct,
//                 orphan }] in exit order; orphan rows (sell with no matching
//                 buy on record) carry null entry fields and null return —
//                 basis is never fabricated.
//   summary  — { openQty, invested, marketValue, unrealizedAbs, unrealizedPct,
//                realizedAbs, realizedPct } (market/unrealized null w/o price)
//   warnings — ['orphan-sells'] when history looks incomplete.
export function buildPerformance(trades, currentPrice = null) {
  const ordered = [...(trades || [])].sort(tradeOrder);
  const lots = [];       // FIFO queue of open buy lots
  const closed = [];
  const warnings = [];
  let realizedAbs = 0;
  let realizedBasis = 0; // matched cost, for the aggregate realized %

  for (const t of ordered) {
    const qty = Number(t.quantity);
    const price = Number(t.price);
    const commission = Number(t.commission) || 0;
    if (!(qty > EPS) || !Number.isFinite(price)) continue;

    if (t.side === 'BUY') {
      lots.push({ id: t.id, date: t.date, qty, unitCost: price + commission / qty });
      continue;
    }

    // SELL — walk the queue front, splitting lots on partial matches.
    const unitProceeds = price - commission / qty;
    let remaining = qty;
    while (remaining > EPS && lots.length) {
      const lot = lots[0];
      const matched = Math.min(lot.qty, remaining);
      const gainAbs = matched * (unitProceeds - lot.unitCost);
      closed.push({
        entryId: lot.id,
        exitId: t.id,
        entryDate: lot.date,
        exitDate: t.date,
        quantity: matched,
        entryUnitCost: lot.unitCost,
        exitUnitProceeds: unitProceeds,
        gainAbs,
        returnPct: unitProceeds / lot.unitCost - 1,
        orphan: false,
      });
      realizedAbs += gainAbs;
      realizedBasis += matched * lot.unitCost;
      lot.qty -= matched;
      remaining -= matched;
      if (lot.qty <= EPS) lots.shift();
    }
    if (remaining > EPS) {
      // Sold more than the recorded buys cover — trades before the log begins.
      closed.push({
        entryId: null,
        exitId: t.id,
        entryDate: null,
        exitDate: t.date,
        quantity: remaining,
        entryUnitCost: null,
        exitUnitProceeds: unitProceeds,
        gainAbs: null,
        returnPct: null,
        orphan: true,
      });
      if (!warnings.includes('orphan-sells')) warnings.push('orphan-sells');
    }
  }

  const hasPrice = Number.isFinite(currentPrice);
  const openLots = lots.map((lot) => {
    const costBasis = lot.qty * lot.unitCost;
    return {
      id: lot.id,
      date: lot.date,
      quantity: lot.qty,
      unitCost: lot.unitCost,
      costBasis,
      unrealizedAbs: hasPrice ? lot.qty * (currentPrice - lot.unitCost) : null,
      unrealizedPct: hasPrice ? currentPrice / lot.unitCost - 1 : null,
    };
  });

  const openQty = openLots.reduce((s, l) => s + l.quantity, 0);
  const invested = openLots.reduce((s, l) => s + l.costBasis, 0);
  const marketValue = hasPrice ? openQty * currentPrice : null;
  const unrealizedAbs = hasPrice ? marketValue - invested : null;

  return {
    openLots,
    closed,
    warnings,
    summary: {
      openQty,
      invested,
      marketValue,
      unrealizedAbs,
      unrealizedPct: hasPrice ? pct(unrealizedAbs, invested) : null,
      realizedAbs,
      realizedPct: pct(realizedAbs, realizedBasis),
    },
  };
}

// Convert every trade into today's split-adjusted share-count terms. The
// price series from /history is itself split-adjusted (yfinance backs splits
// out of the whole Close column), so a trade executed before a split needs
// the same treatment to stay comparable — otherwise a pre-split buy looks
// like a huge loss (or a pre-reverse-split buy like a huge gain) against
// today's price, and FIFO-reconstructed share counts fall short of what IBKR
// actually reports you holding.
//
// For each trade, multiply quantity (divide price) by the product of every
// split whose ex-date falls after the trade — splits before the trade are
// already reflected in the raw execution. Total cost is preserved exactly
// (qty*unitCost is invariant under the scaling), so this only reshapes the
// per-share numbers, never the money.
export function adjustForSplits(trades, splits) {
  if (!splits || !splits.length || !trades || !trades.length) return trades || [];
  const sorted = [...splits].sort((a, b) => a.t.localeCompare(b.t));
  return trades.map((t) => {
    let ratio = 1;
    for (const s of sorted) {
      if (s.t > t.date) ratio *= Number(s.ratio) || 1;
    }
    if (ratio === 1) return t;
    return { ...t, quantity: t.quantity * ratio, price: t.price / ratio };
  });
}

// Chart markers: snap each trade onto the daily close series (latest point at
// or before the trade date; a trade older than the series clamps to its first
// point). Marker sits on the price line (v = close); the trade's own price and
// size ride along for the tooltip.
// Returns { buys, sells } as [{ t, v, quantity, price, id, date }].
export function snapToSeries(trades, priceSeries) {
  const series = priceSeries || [];
  const buys = [];
  const sells = [];
  if (!series.length) return { buys, sells };

  for (const t of trades || []) {
    if (!t.date) continue;
    // series is sorted ascending by t — find the last point <= trade date.
    let snapped = null;
    for (let i = series.length - 1; i >= 0; i -= 1) {
      if (series[i].t <= t.date) { snapped = series[i]; break; }
    }
    if (!snapped) snapped = series[0];
    (t.side === 'SELL' ? sells : buys).push({
      t: snapped.t,
      v: snapped.c,
      quantity: Number(t.quantity),
      price: Number(t.price),
      id: t.id,
      date: t.date,
    });
  }
  return { buys, sells };
}

// "+12.5%" / "−3.1%" / "—" — the one way returns are printed everywhere.
export function fmtPct(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
}

// True when the FIFO-reconstructed open quantity disagrees with what IBKR says
// we hold — the signal for the "incomplete history / possible split" banner.
export function qtyMismatch(openQty, ibkrQty) {
  if (ibkrQty === null || ibkrQty === undefined) return false;
  return Math.abs(Number(openQty) - Number(ibkrQty)) > 1e-6;
}
