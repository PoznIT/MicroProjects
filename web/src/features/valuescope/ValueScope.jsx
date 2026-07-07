import { Box, Typography, Alert, CircularProgress } from '@mui/material';
import WatchlistPanel from './components/watchlist/WatchlistPanel.jsx';
import SymbolSearch from './components/SymbolSearch.jsx';
import SummaryCard from './components/SummaryCard.jsx';
import MetricsTable from './components/MetricsTable.jsx';
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
      <WatchlistPanel current={data} onSelect={(sym) => analyze(sym)} />

      <Typography variant="h4" fontWeight={700}>
        Value<Box component="span" sx={{ color: 'primary.main' }}>Scope</Box>
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        fundamental metrics & a quick value-investing read for any ticker
      </Typography>

      <SymbolSearch
        inputValue={inputValue}
        options={options}
        searching={searching}
        onInput={onInput}
        onPick={onPick}
        onAnalyze={analyze}
      />

      {status && <Alert severity={status.severity} variant="outlined" sx={{ mt: 2, width: '100%', maxWidth: 480 }}
        icon={status.severity === 'info' && analyzing ? <CircularProgress size={18} /> : undefined}>{status.msg}</Alert>}

      {data && scoring && (
        <Box sx={{ width: '100%', maxWidth: 860, mt: 3 }}>
          <SummaryCard data={data} fund={fund} scoring={scoring} sub={sub} />
          <MetricsTable
            type={data.type}
            metrics={M}
            fund={fund}
            expanded={expanded}
            historyState={historyState}
            history={history}
            onToggle={toggleMetric}
          />
        </Box>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ mt: 'auto', pt: 6 }}>
        PoznIT / MicroProjects
      </Typography>
    </Box>
  );
}
