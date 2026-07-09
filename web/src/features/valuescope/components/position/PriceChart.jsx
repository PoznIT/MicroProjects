import { useMemo, useState } from 'react';
import {
  Box, ToggleButton, ToggleButtonGroup, Typography, useTheme,
} from '@mui/material';
import {
  ResponsiveContainer, ComposedChart, Line, Scatter, XAxis, YAxis, Tooltip,
  CartesianGrid,
} from 'recharts';
import { fmtMoney } from '../../lib/score.js';
import { RANGES, priceSeries, tickDate } from '../../lib/history.js';
import { snapToSeries } from '../../lib/trades.js';

const MAX_RANGE = RANGES[RANGES.length - 1].days;

// Buy/sell marker: a solid triangle sitting on the price line (▲ entry,
// ▼ exit). Recharts hands the projected coordinates via cx/cy.
function makeTriangle(up, fill) {
  function Triangle({ cx, cy }) {
    if (cx == null || cy == null) return null;
    const s = 6;
    const points = up
      ? `${cx},${cy - s} ${cx - s},${cy + s} ${cx + s},${cy + s}`
      : `${cx},${cy + s} ${cx - s},${cy - s} ${cx + s},${cy - s}`;
    return <polygon points={points} fill={fill} />;
  }
  return Triangle;
}

// Open the chart on the tightest range that still shows every trade, so entry
// points are never silently out of frame.
function initialRange(trades) {
  const earliest = (trades || []).reduce(
    (min, t) => (t.date && (!min || t.date < min) ? t.date : min), null,
  );
  if (!earliest) return 366;
  const covering = RANGES.find((r) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - r.days);
    return earliest >= cutoff.toISOString().slice(0, 10);
  });
  return covering ? covering.days : MAX_RANGE;
}

// The position price chart: daily closes with every entry (▲) and exit (▼)
// snapped onto the line. Trades outside the picked range are simply not
// plotted — except at the widest range, where pre-history trades clamp to the
// left edge so nothing is hidden.
export default function PriceChart({ history, trades, currency }) {
  const theme = useTheme();
  const [rangeDays, setRangeDays] = useState(() => initialRange(trades));

  // One data array for every series: markers are merged into the price points
  // (buyV/sellV fields) rather than fed to the Scatters as separate arrays —
  // separate per-series data desyncs recharts' category axis.
  const data = useMemo(() => {
    const base = priceSeries(history, rangeDays);
    if (!base.length) return base;
    const visible = rangeDays >= MAX_RANGE
      ? trades
      : (trades || []).filter((t) => t.date >= base[0].t);
    const { buys, sells } = snapToSeries(visible, base);
    const byT = new Map(base.map((p) => [p.t, { ...p }]));
    for (const m of buys) {
      const d = byT.get(m.t);
      d.buyV = m.v;
      d.buys = [...(d.buys || []), m];
    }
    for (const m of sells) {
      const d = byT.get(m.t);
      d.sellV = m.v;
      d.sells = [...(d.sells || []), m];
    }
    return [...byT.values()];
  }, [history, trades, rangeDays]);

  const line = theme.palette.primary.main;
  const buyColor = theme.palette.success.main;
  const sellColor = theme.palette.error.main;

  return (
    <Box>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={rangeDays}
        onChange={(e, v) => { if (v !== null) setRangeDays(v); }}
        sx={{ mb: 1.5 }}
      >
        {RANGES.map((r) => (
          <ToggleButton
            key={r.key}
            value={r.days}
            disabled={priceSeries(history, r.days).length < 2}
          >
            {r.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {data.length < 2 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
          Not enough price history to chart this range.
        </Typography>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
            <CartesianGrid stroke={theme.palette.divider} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="t"
              allowDuplicatedCategory={false}
              tickFormatter={(t) => tickDate(t, rangeDays)}
              minTickGap={40}
              stroke={theme.palette.text.secondary}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              tickFormatter={(v) => fmtMoney(v, currency)}
              width={64}
              stroke={theme.palette.text.secondary}
              tick={{ fontSize: 11 }}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{
                background: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(t) => new Date(t + 'T00:00:00').toLocaleDateString()}
              formatter={(value, name, entry) => {
                if (name === 'Buy' || name === 'Sell') {
                  const fills = (name === 'Buy' ? entry?.payload?.buys : entry?.payload?.sells) || [];
                  const text = fills
                    .map((f) => `${f.quantity} sh @ ${fmtMoney(f.price, currency)} (${f.date})`)
                    .join(' · ');
                  return [text || fmtMoney(value, currency), name];
                }
                return [fmtMoney(value, currency), 'Close'];
              }}
            />
            <Line
              type="monotone"
              dataKey="c"
              name="Price"
              stroke={line}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
            <Scatter dataKey="buyV" name="Buy"
              shape={makeTriangle(true, buyColor)} isAnimationActive={false} />
            <Scatter dataKey="sellV" name="Sell"
              shape={makeTriangle(false, sellColor)} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      )}

      <Typography variant="caption" color="text.disabled" component="p" sx={{ mt: 1 }}>
        ▲ buys · ▼ sells, snapped to the daily close. Quantities and prices
        shown here are adjusted for any splits since the trade, to match this
        split-adjusted price line — the trade log itself keeps your original
        fill.
      </Typography>
    </Box>
  );
}
