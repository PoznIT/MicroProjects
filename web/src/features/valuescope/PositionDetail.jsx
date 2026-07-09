import { useEffect, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button,
  CircularProgress, Paper, Stack, Typography,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faChevronDown, faPlus } from '@fortawesome/free-solid-svg-icons';
import { Link as RouterLink, useOutletContext, useParams } from 'react-router-dom';
import SummaryCard from './components/SummaryCard.jsx';
import MetricsTable from './components/MetricsTable.jsx';
import PriceChart from './components/position/PriceChart.jsx';
import TradeTable from './components/position/TradeTable.jsx';
import TradeDialog from './components/position/TradeDialog.jsx';
import { usePosition } from './hooks/usePosition.js';
import { fmtMoney } from './lib/score.js';
import { fmtPct, qtyMismatch } from './lib/trades.js';
import { IBKR_LIST_NAME } from './lib/watchlist.js';

// One position, in full: the price history with every entry and exit marked,
// each trade's own performance (open lots vs. closed trades), and the classic
// ValueScope valuation read tucked into a collapsible section. Works for
// un-held symbols too — then it's just the valuation plus an empty trade log.

const num = { fontVariantNumeric: 'tabular-nums' };

function Stat({ label, value, sub, color }) {
  return (
    <Box sx={{ minWidth: 110 }}>
      <Typography variant="overline" color="text.secondary" component="div" lineHeight={1.4}>
        {label}
      </Typography>
      <Typography variant="h6" sx={{ ...num, color: color || 'text.primary' }} lineHeight={1.2}>
        {value}
      </Typography>
      {sub && (
        <Typography variant="caption" color="text.secondary" sx={num}>{sub}</Typography>
      )}
    </Box>
  );
}

const gainColor = (v) => (v === null || v === undefined
  ? 'text.secondary' : v >= 0 ? 'success.main' : 'error.main');

export default function PositionDetail() {
  const { symbol: raw } = useParams();
  const symbol = decodeURIComponent(raw || '').trim().toUpperCase();
  const { watchlists, analysis } = useOutletContext();
  const pos = usePosition(symbol);
  const [dialog, setDialog] = useState(null); // { trade } — trade null = add
  const [valOpen, setValOpen] = useState(null); // null = auto until toggled

  // Feed the shared analysis (valuation section + watchlist add target).
  useEffect(() => {
    if (symbol) analysis.analyze(symbol);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run per symbol
  }, [symbol]);

  const holdings = watchlists.lists.find((l) => l.name === IBKR_LIST_NAME);
  const holding = holdings?.items.find((it) => it.symbol === symbol);
  const ibkrPosition = holding?.position || null;
  const currency = ibkrPosition?.currency || analysis.data?.currency || 'USD';

  const { summary, warnings } = pos.performance;
  const hasTrades = pos.trades.length > 0;
  const mismatch = hasTrades && qtyMismatch(summary.openQty, ibkrPosition?.quantity);

  // Without a trade log, fall back to IBKR's aggregate cost basis so the
  // header still says something useful.
  const quickUnrl = ibkrPosition?.avgCost && pos.currentPrice != null
    ? pos.currentPrice / ibkrPosition.avgCost - 1 : null;

  const valuationReady = analysis.data && analysis.data.symbol === symbol && analysis.scoring;

  async function saveTrade(payload) {
    const ok = dialog?.trade
      ? await pos.updateTrade(dialog.trade.id, payload)
      : await pos.addTrade(payload);
    if (ok) setDialog(null);
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 10, px: 2, pb: 4 }}>
      <Box sx={{ width: '100%', maxWidth: 860 }}>
        <Button
          component={RouterLink} to="/valuescope" size="small"
          startIcon={<FontAwesomeIcon icon={faArrowLeft} size="xs" />}
          sx={{ mb: 1 }}
        >
          Portfolio
        </Button>

        {/* Position header */}
        <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="baseline" sx={{ mb: 1.5 }}>
            <Typography variant="h5" fontWeight={700}>{symbol}</Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {analysis.data?.symbol === symbol ? analysis.data.name : holding?.name || ''}
            </Typography>
          </Stack>

          {hasTrades ? (
            <Stack direction="row" spacing={4} useFlexGap flexWrap="wrap">
              <Stat label="Shares" value={summary.openQty.toLocaleString(undefined, { maximumFractionDigits: 4 })} />
              <Stat label="Invested" value={fmtMoney(summary.invested, currency)} />
              <Stat label="Value" value={fmtMoney(summary.marketValue, currency)} />
              <Stat
                label="Unrealized"
                value={fmtPct(summary.unrealizedPct)}
                sub={summary.unrealizedAbs === null ? null : fmtMoney(summary.unrealizedAbs, currency)}
                color={gainColor(summary.unrealizedPct)}
              />
              <Stat
                label="Realized"
                value={fmtPct(summary.realizedPct)}
                sub={fmtMoney(summary.realizedAbs, currency)}
                color={gainColor(summary.realizedPct)}
              />
            </Stack>
          ) : ibkrPosition ? (
            <Stack direction="row" spacing={4} useFlexGap flexWrap="wrap">
              <Stat label="Shares" value={ibkrPosition.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })} />
              <Stat label="Avg cost" value={fmtMoney(ibkrPosition.avgCost, currency)} />
              <Stat label="Price" value={fmtMoney(pos.currentPrice, currency)} />
              <Stat label="Unrealized" value={fmtPct(quickUnrl)} color={gainColor(quickUnrl)} />
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Not in your portfolio — valuation only. Add trades below to track
              a position by hand.
            </Typography>
          )}
        </Paper>

        {(mismatch || warnings.includes('orphan-sells')) && (
          <Alert severity="warning" variant="outlined" sx={{ mb: 2 }}>
            {mismatch && (
              <>Your trade log reconstructs {summary.openQty.toLocaleString()} share(s) but IBKR
              reports {ibkrPosition.quantity.toLocaleString()} — the log is probably missing older
              trades (or a stock split). Add the missing trades below. </>
            )}
            {warnings.includes('orphan-sells')
              && 'Some sells have no matching buy on record; their returns are shown as unknown.'}
          </Alert>
        )}

        {/* Price history with entry/exit markers */}
        <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
          {pos.historyState === 'loading' && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={28} />
            </Box>
          )}
          {pos.historyState === 'error' && (
            <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
              No price history available for {symbol}.
            </Typography>
          )}
          {pos.historyState === 'ready' && (
            <PriceChart history={pos.history} trades={pos.trades} currency={currency} />
          )}
        </Paper>

        {/* Per-trade performance */}
        <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">Trades</Typography>
            <Button
              size="small"
              startIcon={<FontAwesomeIcon icon={faPlus} size="xs" />}
              onClick={() => setDialog({ trade: null })}
            >
              Add trade
            </Button>
          </Box>

          {pos.error && (
            <Alert severity="error" variant="outlined" sx={{ mt: 1 }} onClose={() => pos.setError(null)}>
              {pos.error}
            </Alert>
          )}

          {pos.tradesState === 'loading' && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          )}
          {pos.tradesState === 'error' && (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              Could not load the trade log.
            </Typography>
          )}
          {pos.tradesState === 'ready' && (hasTrades ? (
            <TradeTable
              performance={pos.performance}
              trades={pos.trades}
              currency={currency}
              disabled={pos.saving}
              onEdit={(trade) => setDialog({ trade })}
              onDelete={pos.deleteTrade}
            />
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              No trades recorded for {symbol}. Import from IBKR (last 365 days)
              or add your first trade to see entries, exits and per-trade
              returns on the chart above.
            </Typography>
          ))}
        </Paper>

        {/* The classic ValueScope read, demoted to a section. Controlled:
            auto-opens for symbols without a trade log, until the user picks. */}
        <Accordion
          variant="outlined" disableGutters
          expanded={valOpen ?? (pos.tradesState === 'ready' && !hasTrades)}
          onChange={(e, open) => setValOpen(open)}
        >
          <AccordionSummary expandIcon={<FontAwesomeIcon icon={faChevronDown} size="xs" />}>
            <Typography variant="h6">Valuation</Typography>
            {analysis.analyzing && <CircularProgress size={18} sx={{ ml: 2, alignSelf: 'center' }} />}
          </AccordionSummary>
          <AccordionDetails>
            {analysis.status && (
              <Alert severity={analysis.status.severity} variant="outlined" sx={{ mb: 2 }}>
                {analysis.status.msg}
              </Alert>
            )}
            {valuationReady && (
              <>
                <SummaryCard
                  data={analysis.data}
                  fund={analysis.fund}
                  scoring={analysis.scoring}
                  sub={analysis.sub}
                />
                <MetricsTable
                  type={analysis.data.type}
                  metrics={analysis.metrics}
                  fund={analysis.fund}
                  expanded={analysis.expanded}
                  historyState={analysis.historyState}
                  history={analysis.history}
                  onToggle={analysis.toggleMetric}
                />
              </>
            )}
          </AccordionDetails>
        </Accordion>
      </Box>

      <TradeDialog
        open={dialog !== null}
        trade={dialog?.trade || null}
        saving={pos.saving}
        onClose={() => setDialog(null)}
        onSave={saveTrade}
      />
    </Box>
  );
}
