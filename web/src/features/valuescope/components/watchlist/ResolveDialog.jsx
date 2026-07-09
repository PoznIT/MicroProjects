import { useEffect, useRef, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Autocomplete, TextField, CircularProgress, Typography, Box, Tooltip,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { assetKind } from '../../lib/assets.js';
import { fmtPosition } from '../../lib/watchlist.js';

// Modal for manually linking an unscored watchlist entry (typically an IBKR
// holding whose symbol Yahoo couldn't resolve) to a real search result. Owns its
// own debounced company/ticker search; picking a result hands it back to onResolve,
// which re-points the entry and keeps its position.
export default function ResolveDialog({ item, onClose, onResolve }) {
  const [input, setInput] = useState('');
  const [options, setOptions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [pick, setPick] = useState(null);
  const seqRef = useRef(0);
  const timerRef = useRef(null);

  // Reset each time the dialog opens for a new entry, seeding the box with a
  // sensible query (the entry's name if it has one, else the raw symbol).
  useEffect(() => {
    if (!item) return;
    setInput(item.name && item.name !== item.symbol ? item.name : item.symbol);
    setOptions([]);
    setPick(null);
  }, [item]);

  function onInput(value, reason) {
    setInput(value);
    if (reason !== 'input') return;         // ignore programmatic resets on select
    clearTimeout(timerRef.current);
    if (value.trim().length < 1) { setOptions([]); setSearching(false); return; }
    setSearching(true);
    timerRef.current = setTimeout(async () => {
      const seq = ++seqRef.current;
      try {
        const r = await fetch('/api/valuescope/search?q=' + encodeURIComponent(value.trim()));
        const j = await r.json();
        if (seq !== seqRef.current) return;  // a newer query superseded this one
        setOptions(!r.ok || j.error ? [] : (j.results || []));
      } catch {
        if (seq === seqRef.current) setOptions([]);
      } finally {
        if (seq === seqRef.current) setSearching(false);
      }
    }, 250);
  }

  return (
    <Dialog open={!!item} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 0.5 }}>
        Link {item?.symbol}
        {item?.position && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontVariantNumeric: 'tabular-nums' }}>
            {fmtPosition(item.position)}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {item?.score == null ? (
            <>Couldn&rsquo;t score &ldquo;{item?.symbol}&rdquo;. Search for the matching
              listing to link it — the position you hold is kept and re-scored.</>
          ) : (
            <>&ldquo;{item?.symbol}&rdquo; looks linked to the wrong listing? Search for the
              right one to re-point it — the position you hold is kept and re-scored.</>
          )}
        </Typography>
        <Autocomplete
          freeSolo
          autoHighlight
          options={options}
          loading={searching}
          filterOptions={(x) => x}                 // server-side results, no client filter
          inputValue={input}
          onInputChange={(e, v, reason) => onInput(v, reason)}
          onChange={(e, v) => setPick(typeof v === 'string' ? null : v)}
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
              autoFocus
              placeholder="Search company or ticker"
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
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!pick} onClick={() => onResolve(pick)}>Link</Button>
      </DialogActions>
    </Dialog>
  );
}
