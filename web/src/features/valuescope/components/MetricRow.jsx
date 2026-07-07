import { Fragment } from 'react';
import {
  TableRow, TableCell, Chip, Collapse, Stack, Typography, CircularProgress,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { rate, fmtVal, CHIP_COLOR } from '../lib/score.js';
import { hasHistory } from '../lib/history.js';
import MetricChart from './MetricChart.jsx';

// One metric in the table: a value row plus, for metrics that carry a time
// series (`m.hist`), an expandable chart. The expand state and lazy-loaded
// history are owned by useAnalysis and passed in.
export default function MetricRow({ metric: m, value, isOpen, historyState, history, onToggle }) {
  const r = rate(value, m);
  // Only metrics with a reconstructable/statement series are expandable into a
  // chart — fund metrics have none.
  const expandable = !!m.hist;
  const ready = historyState === 'ready';
  const chartable = expandable && ready && hasHistory(m, history, value);

  return (
    <Fragment>
      <TableRow
        hover={expandable}
        onClick={expandable ? () => onToggle(m.key) : undefined}
        sx={{ cursor: expandable ? 'pointer' : 'default', '& > td': { borderBottom: isOpen ? 'none' : undefined } }}
      >
        <TableCell sx={{ fontWeight: 600, width: 150 }}>
          {expandable && (
            <FontAwesomeIcon
              icon={faChevronRight}
              style={{
                fontSize: 11, marginRight: 8, opacity: 0.5,
                transition: 'transform .15s',
                transform: isOpen ? 'rotate(90deg)' : 'none',
              }}
            />
          )}
          {m.label}
        </TableCell>
        <TableCell sx={{ width: 96 }}>
          <Chip size="small" variant="outlined" color={CHIP_COLOR[r]} label={fmtVal(value, m)} />
        </TableCell>
        <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>{m.note}</TableCell>
      </TableRow>
      {expandable && (
        <TableRow>
          <TableCell colSpan={3} sx={{ p: 0, borderBottom: isOpen ? undefined : 'none' }}>
            <Collapse in={isOpen} timeout="auto" unmountOnExit>
              {historyState === 'loading' && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 2, color: 'text.secondary' }}>
                  <CircularProgress size={16} />
                  <Typography variant="body2">Loading history…</Typography>
                </Stack>
              )}
              {historyState === 'error' && (
                <Typography variant="body2" color="error" sx={{ p: 2 }}>
                  Couldn't load history — please retry.
                </Typography>
              )}
              {ready && !chartable && (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                  No history available for this metric.
                </Typography>
              )}
              {chartable && (
                <MetricChart metric={m} history={history} currentValue={value} />
              )}
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
}
