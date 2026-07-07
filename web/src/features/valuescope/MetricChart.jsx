import { useMemo, useState } from 'react';
import {
  Box, ToggleButton, ToggleButtonGroup, Typography, useTheme,
} from '@mui/material';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ReferenceLine,
} from 'recharts';
import { fmtVal, rate, CHIP_COLOR } from './lib/score.js';
import {
  RANGES, buildSeries, rangeEnabled, defaultRange,
} from './lib/history.js';

// Compact axis label — value without the trailing unit noise on the axis.
function axisFmt(metric, v) {
  if (metric.fmt === '%') return (v * 100).toFixed(0) + '%';
  if (metric.fmt === 'x') return v.toFixed(1);
  return String(v);
}

function tickDate(t, rangeDays) {
  const d = new Date(t + 'T00:00:00');
  if (rangeDays <= 186) {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  if (rangeDays <= 1097) {
    return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  }
  return String(d.getFullYear());
}

export default function MetricChart({ metric, history, currentValue }) {
  const theme = useTheme();
  const [rangeDays, setRangeDays] = useState(
    () => defaultRange(metric, history, currentValue),
  );

  const data = useMemo(
    () => buildSeries(metric, rangeDays, history, currentValue),
    [metric, rangeDays, history, currentValue],
  );

  const colorKey = CHIP_COLOR[rate(currentValue, metric)];
  const color = colorKey === 'default'
    ? theme.palette.text.secondary
    : theme.palette[colorKey].main;
  const isStatement = metric.hist === 'statement';

  return (
    <Box sx={{ px: 2, py: 1.5 }}>
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
            disabled={!rangeEnabled(metric, r.days, history, currentValue)}
          >
            {r.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {data.length < 2 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
          Not enough history to chart this range.
        </Typography>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 4 }}>
            <CartesianGrid stroke={theme.palette.divider} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="t"
              tickFormatter={(t) => tickDate(t, rangeDays)}
              minTickGap={40}
              stroke={theme.palette.text.secondary}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              tickFormatter={(v) => axisFmt(metric, v)}
              width={44}
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
              formatter={(v) => [fmtVal(v, metric), metric.label]}
            />
            {metric.good !== undefined && (
              <ReferenceLine y={metric.good} stroke={theme.palette.success.main}
                strokeDasharray="4 4" strokeOpacity={0.5} />
            )}
            {metric.ok !== undefined && metric.ok !== metric.good && (
              <ReferenceLine y={metric.ok} stroke={theme.palette.warning.main}
                strokeDasharray="4 4" strokeOpacity={0.4} />
            )}
            <Line
              type="monotone"
              dataKey="v"
              stroke={color}
              strokeWidth={2}
              dot={isStatement ? { r: 3, fill: color } : false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      <Typography variant="caption" color="text.disabled" component="p" sx={{ mt: 1 }}>
        {isStatement
          ? 'Reported at fiscal period ends — sparse by nature (annual/quarterly).'
          : 'Approximated from price history; assumes per-share fundamentals held constant.'}
        {metric.good !== undefined && ' Dashed lines mark the favorable / acceptable thresholds.'}
      </Typography>
    </Box>
  );
}
