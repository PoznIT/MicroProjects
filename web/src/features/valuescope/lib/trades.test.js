// Run from web/: node --test src/features/valuescope/lib/trades.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPerformance, snapToSeries, qtyMismatch } from './trades.js';

const buy = (over = {}) => ({
  id: 'b1', date: '2025-01-10', side: 'BUY', quantity: 20, price: 50, commission: 0, ...over,
});
const sell = (over = {}) => ({
  id: 's1', date: '2025-06-10', side: 'SELL', quantity: 20, price: 60, commission: 0, ...over,
});

const approx = (actual, expected, msg) => {
  assert.ok(Math.abs(actual - expected) < 1e-9, msg ?? `${actual} !~ ${expected}`);
};

test('single open buy: unrealized return vs current price', () => {
  const { openLots, closed, summary } = buildPerformance([buy()], 75);
  assert.equal(closed.length, 0);
  assert.equal(openLots.length, 1);
  approx(openLots[0].unrealizedPct, 0.5);       // 50 -> 75
  approx(summary.invested, 1000);
  approx(summary.marketValue, 1500);
  approx(summary.unrealizedPct, 0.5);
  assert.equal(summary.realizedPct, null);       // nothing matched yet
});

test('the user story: two $1000 buys at 50 and 100, price now 75', () => {
  const trades = [
    buy({ id: 'b1', date: '2025-01-10', quantity: 20, price: 50 }),
    buy({ id: 'b2', date: '2025-03-10', quantity: 10, price: 100 }),
  ];
  const { openLots, summary } = buildPerformance(trades, 75);
  approx(openLots[0].unrealizedPct, 0.5);        // first trade +50%
  approx(openLots[1].unrealizedPct, -0.25);      // second trade -25%
  approx(summary.invested, 2000);
  approx(summary.marketValue, 2250);             // 30 sh * $75
  approx(summary.unrealizedPct, 0.125);          // +12.5% overall
});

test('buy then full sell closes the lot with a realized return', () => {
  const { openLots, closed, summary } = buildPerformance([buy(), sell()], 99);
  assert.equal(openLots.length, 0);
  assert.equal(closed.length, 1);
  approx(closed[0].returnPct, 0.2);              // 50 -> 60
  approx(closed[0].gainAbs, 200);
  approx(summary.realizedAbs, 200);
  approx(summary.realizedPct, 0.2);
  approx(summary.openQty, 0);
});

test('a sell spanning two lots splits into two closed trades (FIFO)', () => {
  const trades = [
    buy({ id: 'b1', date: '2025-01-10', quantity: 10, price: 50 }),
    buy({ id: 'b2', date: '2025-02-10', quantity: 10, price: 80 }),
    sell({ id: 's1', date: '2025-06-10', quantity: 15, price: 100 }),
  ];
  const { openLots, closed } = buildPerformance(trades, 100);
  assert.equal(closed.length, 2);
  assert.equal(closed[0].entryId, 'b1');         // oldest lot consumed first
  approx(closed[0].quantity, 10);
  approx(closed[0].returnPct, 1.0);              // 50 -> 100
  assert.equal(closed[1].entryId, 'b2');
  approx(closed[1].quantity, 5);
  approx(closed[1].returnPct, 0.25);             // 80 -> 100
  assert.equal(openLots.length, 1);
  approx(openLots[0].quantity, 5);               // rest of lot b2 stays open
});

test('fractional shares survive matching without residue', () => {
  const trades = [
    buy({ quantity: 3.3333, price: 30 }),
    sell({ quantity: 3.3333, price: 45 }),
  ];
  const { openLots, closed, summary } = buildPerformance(trades, 45);
  assert.equal(openLots.length, 0);
  assert.equal(closed.length, 1);
  approx(closed[0].returnPct, 0.5);
  approx(summary.openQty, 0);
});

test('commissions raise cost basis and cut proceeds, pro-rata per share', () => {
  const trades = [
    buy({ quantity: 10, price: 100, commission: 10 }),   // unit cost 101
    sell({ quantity: 10, price: 110, commission: 10 }),  // unit proceeds 109
  ];
  const { closed } = buildPerformance(trades, null);
  approx(closed[0].entryUnitCost, 101);
  approx(closed[0].exitUnitProceeds, 109);
  approx(closed[0].gainAbs, 80);                 // 10 * (109 - 101)
  approx(closed[0].returnPct, 8 / 101);
});

test('sell with no recorded buys becomes an orphan row, never fake basis', () => {
  const { closed, warnings, summary } = buildPerformance([sell({ quantity: 5 })], 60);
  assert.equal(closed.length, 1);
  assert.equal(closed[0].orphan, true);
  assert.equal(closed[0].entryUnitCost, null);
  assert.equal(closed[0].returnPct, null);
  assert.deepEqual(warnings, ['orphan-sells']);
  approx(summary.realizedAbs, 0);                // orphans don't count realized
});

test('same-day trades fall back to id order (buy id sorts before sell id)', () => {
  const trades = [
    sell({ id: 'z-sell', date: '2025-01-10', quantity: 10, price: 55 }),
    buy({ id: 'a-buy', date: '2025-01-10', quantity: 10, price: 50 }),
  ];
  const { closed, warnings } = buildPerformance(trades, 55);
  assert.equal(warnings.length, 0);              // buy processed first
  assert.equal(closed[0].entryId, 'a-buy');
});

test('empty and null input produce an empty, priceless summary', () => {
  const { openLots, closed, summary, warnings } = buildPerformance([], null);
  assert.equal(openLots.length + closed.length + warnings.length, 0);
  approx(summary.openQty, 0);
  assert.equal(summary.marketValue, null);
  assert.equal(summary.unrealizedPct, null);
});

test('snapToSeries lands markers on the last close at or before the trade', () => {
  const series = [
    { t: '2025-01-06', c: 48 },
    { t: '2025-01-07', c: 49 },
    { t: '2025-01-10', c: 51 },
  ];
  const trades = [
    buy({ id: 'b1', date: '2025-01-08' }),                  // gap -> snaps back
    sell({ id: 's1', date: '2025-01-10', quantity: 5 }),    // exact match
    buy({ id: 'b0', date: '2024-12-01' }),                  // pre-series -> clamps
  ];
  const { buys, sells } = snapToSeries(trades, series);
  assert.equal(buys.length, 2);
  assert.equal(sells.length, 1);
  assert.equal(buys.find((m) => m.id === 'b1').t, '2025-01-07');
  approx(buys.find((m) => m.id === 'b1').v, 49);
  assert.equal(sells[0].t, '2025-01-10');
  assert.equal(buys.find((m) => m.id === 'b0').t, '2025-01-06');
  assert.equal(buys.find((m) => m.id === 'b0').date, '2024-12-01'); // real date kept
});

test('qtyMismatch flags incomplete history but tolerates float noise', () => {
  assert.equal(qtyMismatch(30, 30.0000000001), false);
  assert.equal(qtyMismatch(30, 40), true);
  assert.equal(qtyMismatch(30, null), false);    // no IBKR figure -> no banner
});
