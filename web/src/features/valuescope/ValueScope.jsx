import { Fragment } from 'react';
import {
  Box, Typography, Paper, TextField, Button, Autocomplete, CircularProgress,
  Chip, Table, TableBody, TableRow, TableCell, Stack, Alert, Collapse, Tooltip,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons';
import Watchlist from './Watchlist.jsx';
import MetricChart from './MetricChart.jsx';
import { groupsFor, rate, fmtVal, fmtMoney, CHIP_COLOR } from './lib/score.js';
import { hasHistory } from './lib/history.js';
import { assetKind } from './lib/assets.js';
import { useAnalysis } from './hooks/useAnalysis.js';

export default function ValueScope() {
  const {
    inputValue, options, searching, status, analyzing,
    data, expanded, history, historyState,
    metrics: M, fund, scoring, sub,
    onInput, onPick, analyze, toggleMetric,
  } = useAnalysis();

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 12, px: 2, pb: 4 }}>
      <Watchlist current={data} onSelect={(sym) => analyze(sym)} />

      <Typography variant="h4" fontWeight={700}>
        Value<Box component="span" sx={{ color: 'primary.main' }}>Scope</Box>
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        fundamental metrics & a quick value-investing read for any ticker
      </Typography>

      <Stack spacing={1.5} sx={{ width: '100%', maxWidth: 480 }}>
        <Autocomplete
          freeSolo
          options={options}
          loading={searching}
          filterOptions={(x) => x}                 // server-side results, no client filter
          inputValue={inputValue}
          onInputChange={(e, v, reason) => onInput(v, reason)}
          onChange={(e, v) => onPick(v)}
          getOptionLabel={(o) => (typeof o === 'string' ? o : o.symbol)}
          isOptionEqualToValue={(o, v) => o.symbol === v.symbol}
          noOptionsText="No matching companies found."
          renderOption={(props, o) => {
            const kind = assetKind(o.type);
            return (
              <Box component="li" {...props} key={o.symbol}>
                <Tooltip title={kind.title} placement="left">
                  <Box component="span" sx={{ width: 20, textAlign: 'center', color: 'text.secondary' }}>
                    <FontAwesomeIcon icon={kind.icon} />
                  </Box>
                </Tooltip>
                <Typography sx={{ fontWeight: 600, minWidth: 60, ml: 1 }}>{o.symbol}</Typography>
                <Typography variant="body2" color="text.secondary" noWrap sx={{ flex: 1, mx: 1 }}>{o.name}</Typography>
                <Typography variant="caption" color="text.disabled">{o.exchange}</Typography>
              </Box>
            );
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Search company or ticker — e.g. Apple or AAPL"
              onKeyDown={(e) => { if (e.key === 'Enter' && inputValue.trim()) analyze(); }}
              slotProps={{
                input: {
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {searching ? <CircularProgress color="inherit" size={18} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                },
              }}
            />
          )}
        />
        <Button variant="contained" size="large" onClick={() => analyze()}>Analyze</Button>
      </Stack>

      {status && <Alert severity={status.severity} variant="outlined" sx={{ mt: 2, width: '100%', maxWidth: 480 }}
        icon={status.severity === 'info' && analyzing ? <CircularProgress size={18} /> : undefined}>{status.msg}</Alert>}

      {data && scoring && (
        <Box sx={{ width: '100%', maxWidth: 860, mt: 3 }}>
          <Paper variant="outlined" sx={{ p: 3, mb: 2, display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="h5" fontWeight={700}>{data.symbol}</Typography>
                <Chip
                  size="small" variant="outlined"
                  icon={<FontAwesomeIcon icon={assetKind(data.type).icon} style={{ fontSize: 12 }} />}
                  label={assetKind(data.type).label}
                />
              </Stack>
              <Typography variant="body2">{data.name}</Typography>
              <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
                {sub}{sub ? <br /> : null}
                {fund ? 'Assets ' + fmtMoney(data.aum, data.currency)
                      : 'Market cap ' + fmtMoney(data.marketCap, data.currency)}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="overline" color="text.secondary">Price</Typography>
              <Typography variant="h6">{fmtMoney(data.price, data.currency)}</Typography>
            </Box>
            <Stack alignItems="center" spacing={0.5}>
              <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                <CircularProgress variant="determinate" value={scoring.score} size={88} thickness={4} color={scoring.color} />
                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="h5" color={`${scoring.color}.main`} fontWeight={700} lineHeight={1}>{scoring.score}</Typography>
                  <Typography variant="caption" color="text.secondary">/ 100</Typography>
                </Box>
              </Box>
              <Chip size="small" color={scoring.color} label={scoring.verdict} />
            </Stack>
          </Paper>

          {groupsFor(data.type).map(g => (
            <Box key={g.title} sx={{ mb: 2 }}>
              <Typography variant="overline" color="text.secondary" sx={{ pl: 0.5 }}>{g.title}</Typography>
              <Paper variant="outlined">
                <Table size="small">
                  <TableBody>
                    {g.items.map(m => {
                      const r = rate(M[m.key], m);
                      // Only metrics with a reconstructable/statement series are
                      // expandable into a chart — fund metrics have none.
                      const expandable = !!m.hist;
                      const isOpen = expandable && expanded === m.key;
                      const ready = historyState === 'ready';
                      const chartable = expandable && ready && hasHistory(m, history, M[m.key]);
                      return (
                        <Fragment key={m.key}>
                          <TableRow
                            hover={expandable}
                            onClick={expandable ? () => toggleMetric(m.key) : undefined}
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
                              <Chip size="small" variant="outlined" color={CHIP_COLOR[r]} label={fmtVal(M[m.key], m)} />
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
                                  <MetricChart metric={m} history={history} currentValue={M[m.key]} />
                                )}
                              </Collapse>
                            </TableCell>
                          </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
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
        </Box>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ mt: 'auto', pt: 6 }}>
        PoznIT / MicroProjects
      </Typography>
    </Box>
  );
}
