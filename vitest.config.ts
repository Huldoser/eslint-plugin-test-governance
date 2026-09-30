import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/rules/**', 'src/utils/**'],
      reporter: ['text', 'text-summary'],
      thresholds: { branches: 100, functions: 100, lines: 100, statements: 100 },
    },
  },
});
