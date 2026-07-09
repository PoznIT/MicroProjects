import { useEffect, useState } from 'react';
import {
  Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem,
  Stack, TextField,
} from '@mui/material';

// Add/edit form for one trade. Used for hand-entered history (IBKR's Flex
// window only reaches back 365 days) and for correcting any imported row.
// Validation mirrors the backend's TradeIn model so errors surface before the
// round-trip.

const EMPTY = { date: '', side: 'BUY', quantity: '', price: '', commission: '0', note: '' };

function toForm(trade) {
  if (!trade) return EMPTY;
  return {
    date: trade.date || '',
    side: trade.side || 'BUY',
    quantity: String(trade.quantity ?? ''),
    price: String(trade.price ?? ''),
    commission: String(trade.commission ?? 0),
    note: trade.note || '',
  };
}

export default function TradeDialog({ open, trade, saving, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY);
  useEffect(() => { if (open) setForm(toForm(trade)); }, [open, trade]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const quantity = Number(form.quantity);
  const price = Number(form.price);
  const commission = Number(form.commission || 0);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(form.date)
    && quantity > 0 && Number.isFinite(price) && price >= 0
    && Number.isFinite(commission) && commission >= 0;

  const submit = () => onSave({
    date: form.date,
    side: form.side,
    quantity,
    price,
    commission,
    note: form.note.trim(),
    // Preserve what the import recorded; manual entries default sensibly.
    time: trade?.time || null,
    currency: trade?.currency || 'USD',
    assetCategory: trade?.assetCategory || 'STK',
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{trade ? 'Edit trade' : 'Add trade'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={2}>
            <TextField
              select label="Side" value={form.side} onChange={set('side')} sx={{ width: 120 }}>
              <MenuItem value="BUY">Buy</MenuItem>
              <MenuItem value="SELL">Sell</MenuItem>
            </TextField>
            <TextField
              label="Date" type="date" value={form.date} onChange={set('date')}
              slotProps={{ inputLabel: { shrink: true } }} fullWidth
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Quantity" value={form.quantity} onChange={set('quantity')}
              slotProps={{ htmlInput: { inputMode: 'decimal' } }} fullWidth
            />
            <TextField
              label="Price / share" value={form.price} onChange={set('price')}
              slotProps={{ htmlInput: { inputMode: 'decimal' } }} fullWidth
            />
          </Stack>
          <TextField
            label="Commission" value={form.commission} onChange={set('commission')}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }}
            helperText="Total fees for this fill — folded into the trade's cost."
          />
          <TextField
            label="Note" value={form.note} onChange={set('note')}
            slotProps={{ htmlInput: { maxLength: 200 } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!valid || saving} onClick={submit}>
          {trade ? 'Save' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
