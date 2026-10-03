import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  ThemeContext,
  type Theme,
} from './theme-context';

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // localStorage may be unavailable (private mode / blocked) — fall back.
  }
  return DEFAULT_THEME;
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Theme provider (DESIGN_SYSTEM.md §10). Dark-mode-first; the choice is
 * persisted to localStorage with try/catch so a blocked store never breaks the
 * app. Applies `data-theme` on the document root so tokens/Tailwind switch.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme());

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore persistence failures; the in-memory theme still applies.
    }
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const toggleTheme = useCallback(
    () => setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark')),
    [],
  );

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
