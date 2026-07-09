import { useMemo, useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { getTheme } from './mui-theme.js';
import TopBar from './components/TopBar.jsx';
import ValueScopeLayout from './features/valuescope/ValueScopeLayout.jsx';
import PortfolioView from './features/valuescope/PortfolioView.jsx';
import PositionDetail from './features/valuescope/PositionDetail.jsx';

export default function App() {
  const [mode, setMode] = useState(() => localStorage.getItem('vs-theme') || 'dark');
  useEffect(() => { localStorage.setItem('vs-theme', mode); }, [mode]);
  const toggle = useCallback(() => setMode(m => (m === 'light' ? 'dark' : 'light')), []);

  const theme = useMemo(() => getTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <TopBar mode={mode} toggle={toggle} />
      <Routes>
        {/* ValueScope stays mounted under /valuescope; the feature's internal
            links and API calls are all rooted there. */}
        <Route path="/valuescope" element={<ValueScopeLayout />}>
          <Route index element={<PortfolioView />} />
          <Route path="position/:symbol" element={<PositionDetail />} />
        </Route>
        <Route path="*" element={<Navigate to="/valuescope" replace />} />
      </Routes>
    </ThemeProvider>
  );
}
