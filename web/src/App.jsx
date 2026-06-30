import { Routes, Route, useLocation } from 'react-router-dom';
import TopBar from './components/TopBar.jsx';
import { useTheme } from './theme.js';
import Home from './pages/Home.jsx';
import ValueScope from './pages/ValueScope.jsx';
import YTAudio from './pages/YTAudio.jsx';
import TimePunch from './pages/TimePunch.jsx';

export default function App() {
  const { theme, toggle } = useTheme();
  const { pathname } = useLocation();

  // TimePunch has its own full-width header with action buttons, so the
  // shared centered top bar is suppressed on that route.
  const ownsHeader = pathname === '/timepunch';

  return (
    <>
      {!ownsHeader && <TopBar theme={theme} toggle={toggle} />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/valuescope" element={<ValueScope />} />
        <Route path="/ytaudio" element={<YTAudio />} />
        <Route path="/timepunch" element={<TimePunch theme={theme} toggle={toggle} />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </>
  );
}
