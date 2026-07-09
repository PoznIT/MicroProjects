import {
  Alert, Box, Button, Chip, CircularProgress, Paper, Table, TableBody,
  TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import { useOutletContext } from 'react-router-dom';
import SymbolSearch from './components/SymbolSearch.jsx';
import { fmtMoney } from './lib/score.js';
import { fmtPct } from './lib/trades.js';
import { IBKR_LIST_NAME } from './lib/watchlist.js';

// The ValueScope landing page: your IBKR positions with value and P&L at a
// glance. Rows open the per-position analysis (chart, trade log, valuation);
// the search box opens the same detail view for any symbol, held or not.

const num = { fontVariantNumeric: 'tabular-nums' };

function PositionsTable({ items, onOpen }) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Symbol</TableCell>
          <TableCell align="right">Qty</TableCell>
          <TableCell align="right">Avg cost</TableCell>
          <TableCell align="right">Price</TableCell>
          <TableCell align="right">Value</TableCell>
          <TableCell align="right">Unrealized</TableCell>
          <TableCell align="right">Score</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((it) => {
          const { quantity, avgCost, currency } = it.position;
          const value = it.price != null ? quantity * it.price : null;
          const unrl = it.price != null && avgCost ? it.price / avgCost - 1 : null;
          return (
            <TableRow key={it.symbol} hover onClick={() => onOpen(it.symbol)} sx={{ cursor: 'pointer' }}>
              <TableCell>
                <Typography variant="body2" fontWeight={700}>{it.symbol}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                  {it.name}
                </Typography>
              </TableCell>
              <TableCell align="right" sx={num}>
                {quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </TableCell>
              <TableCell align="right" sx={num}>{fmtMoney(avgCost, currency)}</TableCell>
              <TableCell align="right" sx={num}>{fmtMoney(it.price, currency)}</TableCell>
              <TableCell align="right" sx={num}>{fmtMoney(value, currency)}</TableCell>
              <TableCell align="right">
                <Typography variant="body2" component="span" sx={{
                  ...num, fontWeight: 600,
                  color: unrl === null ? 'text.secondary' : unrl >= 0 ? 'success.main' : 'error.main',
                }}>
                  {fmtPct(unrl)}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Chip size="small" color={it.color} label={it.score ?? '…'} sx={{ minWidth: 44 }} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default function PortfolioView() {
  const { watchlists, analysis, openPosition } = useOutletContext();
  const { importing, importingCsv, importFromIbkr, importCsv, notice } = watchlists;
  const { inputValue, options, searching, onInput } = analysis;
  const busy = importing || importingCsv;

  const holdings = watchlists.lists.find((l) => l.name === IBKR_LIST_NAME);
  const positions = (holdings?.items || []).filter((it) => it.position);

  const pickSymbol = (value) => {
    const symbol = typeof value === 'string' ? value : value?.symbol;
    if (symbol && symbol.trim()) openPosition(symbol);
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 12, px: 2, pb: 4 }}>
      <Typography variant="h4" fontWeight={700}>
        Value<Box component="span" sx={{ color: 'primary.main' }}>Scope</Box>
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        your positions, trade by trade — plus a value read on any ticker
      </Typography>

      <SymbolSearch
        inputValue={inputValue}
        options={options}
        searching={searching}
        onInput={onInput}
        onPick={pickSymbol}
        onAnalyze={() => pickSymbol(inputValue)}
      />

      <Box sx={{ width: '100%', maxWidth: 860, mt: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="h6">Portfolio</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              component="label"
              disabled={busy}
              startIcon={importingCsv ? <CircularProgress size={14} /> : null}
            >
              {importingCsv ? 'Importing…' : 'Import trades CSV'}
              <input type="file" accept=".csv,text/csv" hidden onChange={importCsv} />
            </Button>
            <Button
              size="small"
              disabled={busy}
              onClick={importFromIbkr}
              startIcon={importing ? <CircularProgress size={14} /> : null}
            >
              {importing ? 'Importing…' : 'Import from IBKR'}
            </Button>
          </Box>
        </Box>

        {notice && (
          <Alert
            severity={notice.error ? 'error' : 'info'}
            variant="outlined" sx={{ mb: 1 }}
            onClose={() => watchlists.setNotice(null)}
          >
            {notice.text}
          </Alert>
        )}

        {positions.length ? (
          <Paper variant="outlined">
            <PositionsTable items={positions} onOpen={openPosition} />
          </Paper>
        ) : (
          <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              No positions yet. Import your IBKR holdings to start analyzing
              them trade by trade, or search any ticker above.
            </Typography>
            <Button variant="contained" disabled={busy} onClick={importFromIbkr}>
              Import from IBKR
            </Button>
          </Paper>
        )}
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 'auto', pt: 6 }}>
        PoznIT / MicroProjects
      </Typography>
    </Box>
  );
}
