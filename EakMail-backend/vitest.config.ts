import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test-setup.ts'],
  },
  resolve: {
    alias: {
      // resolve workspace package to its source
      '@eakmail/shared-types': new URL('../packages/shared-types/src/index.ts', import.meta.url).pathname,
    },
  },
});
