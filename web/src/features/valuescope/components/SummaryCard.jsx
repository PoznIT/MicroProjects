import { Box, Paper, Stack, Typography, Chip } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { fmtMoney } from '../lib/score.js';
import { assetKind } from '../lib/assets.js';
import ScoreGauge from './ScoreGauge.jsx';

// Header card for an analyzed symbol: identity (symbol/name/sector or category),
// price, and the value score gauge. `sub` is the pre-joined sector·industry (or
// category·family) line; `fund` picks AUM vs. market cap wording.
export default function SummaryCard({ data, fund, scoring, sub }) {
  const kind = assetKind(data.type);
  return (
    <Paper variant="outlined" sx={{ p: 3, mb: 2, display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
      <Box sx={{ flex: 1, minWidth: 200 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h5" fontWeight={700}>{data.symbol}</Typography>
          <Chip
            size="small" variant="outlined"
            icon={<FontAwesomeIcon icon={kind.icon} style={{ fontSize: 12 }} />}
            label={kind.label}
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
      <ScoreGauge score={scoring.score} color={scoring.color} verdict={scoring.verdict} />
    </Paper>
  );
}
