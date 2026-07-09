import { Box, Stack, Typography, Chip, CircularProgress } from '@mui/material';

// The circular 0–100 value score with its verdict chip, shown in the summary
// card. `color` is a MUI palette key (success/info/error) chosen by computeScore.
export default function ScoreGauge({ score, color, verdict }) {
  return (
    <Stack alignItems="center" spacing={0.5}>
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <CircularProgress variant="determinate" value={score} size={88} thickness={4} color={color} />
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="h5" color={`${color}.main`} fontWeight={700} lineHeight={1}>{score}</Typography>
          <Typography variant="caption" color="text.secondary">/ 100</Typography>
        </Box>
      </Box>
      <Chip size="small" color={color} label={verdict} />
    </Stack>
  );
}
