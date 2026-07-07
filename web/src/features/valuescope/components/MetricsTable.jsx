import { Box, Paper, Typography, Table, TableBody } from '@mui/material';
import { groupsFor } from '../lib/score.js';
import MetricRow from './MetricRow.jsx';

// The grouped metric tables for an analyzed symbol, plus the color-coding
// disclaimer. Rubric (equity vs. fund) is chosen by asset type; per-row expand
// state and lazy history come from useAnalysis.
export default function MetricsTable({ type, metrics: M, fund, expanded, historyState, history, onToggle }) {
  return (
    <>
      {groupsFor(type).map(g => (
        <Box key={g.title} sx={{ mb: 2 }}>
          <Typography variant="overline" color="text.secondary" sx={{ pl: 0.5 }}>{g.title}</Typography>
          <Paper variant="outlined">
            <Table size="small">
              <TableBody>
                {g.items.map(m => (
                  <MetricRow
                    key={m.key}
                    metric={m}
                    value={M[m.key]}
                    isOpen={!!m.hist && expanded === m.key}
                    historyState={historyState}
                    history={history}
                    onToggle={onToggle}
                  />
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Box>
      ))}

      <Typography variant="caption" color="text.disabled" component="p" sx={{ mt: 1 }}>
        Color coding compares each metric against common{' '}
        {fund ? 'fund-selection rules of thumb — cost, income and trailing returns'
              : 'value-investing rules of thumb'}{' '}
        (green = favorable, blue = acceptable, red = caution, grey = no data / informational).
        {fund ? ' Past performance doesn’t predict future returns.' : ''} Thresholds are generic
        and ignore {fund ? 'category' : 'sector'} context. Informational only — not investment advice.
      </Typography>
    </>
  );
}
