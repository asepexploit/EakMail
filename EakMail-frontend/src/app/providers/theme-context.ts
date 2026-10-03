import { createContext } from 'react';

export type Theme = 'dark' | 'light';

export interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

/** Shared theme context (provider in theme-provider.tsx, hook in useTheme.ts). */
export const ThemeContext = createContext<ThemeContextValue | null>(null);

export const THEME_STORAGE_KEY = 'eakmail.theme';
export const DEFAULT_THEME: Theme = 'dark';
