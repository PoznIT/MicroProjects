import { useMemo, useState, useEffect, useCallback } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { getTheme } from './mui-theme.js';
import TopBar from './components/TopBar.jsx';
import Home from './pages/Home.jsx';
import ValueScope from './pages/ValueScope.jsx';
import YTAudio from './pages/YTAudio.jsx';
import TimePunch from './pages/TimePunch.jsx';

export default function App() {
  const [mode, setMode] = useState(() => localStorage.getItem('mp-theme') || 'dark');
  useEffect(() => { localStorage.setItem('mp-theme', mode); }, [mode]);
  const toggle = useCallback(() => setMode(m => (m === 'light' ? 'dark' : 'light')), []);

  const theme = useMemo(() => getTheme(mode), [mode]);
  const { pathname } = useLocation();

  // TimePunch renders its own full-width AppBar with action buttons.
  const ownsHeader = pathname === '/timepunch';

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {!ownsHeader && <TopBar mode={mode} toggle={toggle} />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/valuescope" element={<ValueScope />} />
        <Route path="/ytaudio" element={<YTAudio />} />
        <Route path="/timepunch" element={<TimePunch mode={mode} toggle={toggle} />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </ThemeProvider>
  );
}
