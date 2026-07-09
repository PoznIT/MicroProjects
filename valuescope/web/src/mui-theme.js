import { createTheme } from '@mui/material/styles';

// MUI theme replaces the old hand-rolled CSS-variable theme. The accent green,
// blue, and red carry over as primary/info/error so the value-investing color
// coding (good / acceptable / caution) maps onto MUI palette slots.
const dark = {
  mode: 'dark',
  primary: { main: '#00e5a0', contrastText: '#0b0c0e' },
  success: { main: '#00e5a0' },
  info: { main: '#5b9cf6' },
  warning: { main: '#fbbf5a' },
  error: { main: '#ff5f5f' },
  background: { default: '#0b0c0e', paper: '#13151a' },
};

const light = {
  mode: 'light',
  primary: { main: '#059669', contrastText: '#ffffff' },
  success: { main: '#059669' },
  info: { main: '#2563eb' },
  warning: { main: '#b45309' },
  error: { main: '#dc2626' },
  background: { default: '#f8fafc', paper: '#ffffff' },
};

export const getTheme = (mode) =>
  createTheme({
    palette: mode === 'light' ? light : dark,
    shape: { borderRadius: 8 },
    typography: {
      fontFamily:
        'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    },
  });
