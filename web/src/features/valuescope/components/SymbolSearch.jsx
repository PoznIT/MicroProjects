import {
  Box, Stack, Button, TextField, Autocomplete, CircularProgress, Typography, Tooltip,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { assetKind } from '../lib/assets.js';

// The company/ticker search box with server-backed autocomplete and the Analyze
// button. All state lives in useAnalysis; this is the presentation + wiring.
export default function SymbolSearch({ inputValue, options, searching, onInput, onPick, onAnalyze }) {
  return (
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
            onKeyDown={(e) => { if (e.key === 'Enter' && inputValue.trim()) onAnalyze(); }}
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
      <Button variant="contained" size="large" onClick={() => onAnalyze()}>Analyze</Button>
    </Stack>
  );
}
