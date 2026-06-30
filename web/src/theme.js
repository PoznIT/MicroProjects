import { useEffect, useState, useCallback } from 'react';

const THEME_KEY = 'mp-theme';

// Hook that mirrors the original shared/theme.js behavior: persist the choice
// in localStorage under 'mp-theme' and reflect it on <html data-theme>.
export function useTheme() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem(THEME_KEY) || 'dark'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggle = useCallback(
    () => setTheme(t => (t === 'light' ? 'dark' : 'light')),
    []
  );

  return { theme, toggle };
}
