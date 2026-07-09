import {
  Box, Chip, IconButton, Table, TableBody, TableCell, TableHead, TableRow,
  Tooltip, Typography,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen, faXmark } from '@fortawesome/free-solid-svg-icons';
import { fmtMoney } from '../../lib/score.js';
import { fmtPct } from '../../lib/trades.js';

// The per-trade performance tables: open lots (each buy judged against the
// current price) and closed trades (each FIFO entry→exit match with its own
// realized return). Rows are derived from the raw trade log, so edit/delete
// target the underlying trade: a lot edits its buy, a closed row its sell.

const num = { fontVariantNumeric: 'tabular-nums' };

function Pct({ v }) {
  const color = v === null || v === undefined ? 'text.secondary'
    : v >= 0 ? 'success.main' : 'error.main';
  return <Typography variant="body2" component="span" sx={{ ...num, color, fontWeight: 600 }}>{fmtPct(v)}</Typography>;
}

function SourceChip({ id }) {
  const manual = (id || '').startsWith('manual:');
  return (
    <Chip size="small" variant="outlined" label={manual ? 'manual' : 'IBKR'}
      sx={{ height: 18, fontSize: 10 }} />
  );
}

function RowActions({ trade, onEdit, onDelete, disabled }) {
  if (!trade) return null;
  return (
    <Box sx={{ whiteSpace: 'nowrap' }}>
      <Tooltip title="Edit this trade">
        <span>
          <IconButton size="small" disabled={disabled} onClick={() => onEdit(trade)}>
            <FontAwesomeIcon icon={faPen} size="xs" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Delete this trade">
        <span>
          <IconButton size="small" disabled={disabled} onClick={() => onDelete(trade.id)}>
            <FontAwesomeIcon icon={faXmark} size="xs" />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
}

function SectionTitle({ children }) {
  return (
    <Typography variant="overline" color="text.secondary" component="div" sx={{ mt: 2 }}>
      {children}
    </Typography>
  );
}

export default function TradeTable({
  performance, trades, currency, onEdit, onDelete, disabled,
}) {
  const { openLots, closed } = performance;
  const byId = new Map((trades || []).map((t) => [t.id, t]));
  const qty = (v) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 4 });

  return (
    <Box>
      {openLots.length > 0 && (
        <>
          <SectionTitle>Open lots</SectionTitle>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Entry</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell align="right">Unit cost</TableCell>
                <TableCell align="right">Value now</TableCell>
                <TableCell align="right">Return</TableCell>
                <TableCell align="right">Source</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {openLots.map((lot, i) => (
                <TableRow key={`${lot.id}-${i}`} hover>
                  <TableCell sx={num}>{lot.date}</TableCell>
                  <TableCell align="right" sx={num}>{qty(lot.quantity)}</TableCell>
                  <TableCell align="right" sx={num}>{fmtMoney(lot.unitCost, currency)}</TableCell>
                  <TableCell align="right" sx={num}>
                    {lot.unrealizedAbs === null ? '—'
                      : fmtMoney(lot.costBasis + lot.unrealizedAbs, currency)}
                  </TableCell>
                  <TableCell align="right"><Pct v={lot.unrealizedPct} /></TableCell>
                  <TableCell align="right"><SourceChip id={lot.id} /></TableCell>
                  <TableCell align="right">
                    <RowActions trade={byId.get(lot.id)} onEdit={onEdit} onDelete={onDelete} disabled={disabled} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

      {closed.length > 0 && (
        <>
          <SectionTitle>Closed trades</SectionTitle>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Entry</TableCell>
                <TableCell>Exit</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell align="right">In</TableCell>
                <TableCell align="right">Out</TableCell>
                <TableCell align="right">P&L</TableCell>
                <TableCell align="right">Return</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {closed.map((c, i) => (
                <TableRow key={`${c.exitId}-${i}`} hover>
                  <TableCell sx={num}>
                    {c.orphan
                      ? <Typography variant="body2" color="warning.main">entry unknown</Typography>
                      : c.entryDate}
                  </TableCell>
                  <TableCell sx={num}>{c.exitDate}</TableCell>
                  <TableCell align="right" sx={num}>{qty(c.quantity)}</TableCell>
                  <TableCell align="right" sx={num}>
                    {c.entryUnitCost === null ? '—' : fmtMoney(c.entryUnitCost, currency)}
                  </TableCell>
                  <TableCell align="right" sx={num}>{fmtMoney(c.exitUnitProceeds, currency)}</TableCell>
                  <TableCell align="right" sx={num}>
                    {c.gainAbs === null ? '—' : fmtMoney(c.gainAbs, currency)}
                  </TableCell>
                  <TableCell align="right"><Pct v={c.returnPct} /></TableCell>
                  <TableCell align="right">
                    <RowActions trade={byId.get(c.exitId)} onEdit={onEdit} onDelete={onDelete} disabled={disabled} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </Box>
  );
}
