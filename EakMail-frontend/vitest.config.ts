import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Frontend unit tests. Pure functions and lib/ helpers only — no DOM renderer is
// installed (jsdom / @testing-library are intentionally not deps), so the default
// `node` environment is used and browser globals are stubbed per-test where needed.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
