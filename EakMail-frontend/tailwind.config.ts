import type { Config } from 'tailwindcss';

// Design tokens map to CSS variables defined in src/styles/tokens.css (DESIGN_SYSTEM.md §3).
// Dark-mode-first via [data-theme] (DESIGN_SYSTEM.md §10).
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        brand: 'var(--brand)',
        'brand-accent': 'var(--brand-accent)',
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        border: 'var(--border)',
        text: 'var(--text)',
        'text-muted': 'var(--text-muted)',
        success: 'var(--success)',
        running: 'var(--running)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        neutral: 'var(--neutral)',
        info: 'var(--info)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: { sm: '8px', md: '12px', lg: '16px' },
    },
  },
  plugins: [],
} satisfies Config;
