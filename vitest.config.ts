import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 120_000,
    // Generation timings are reported by the last suite, so keep files and tests in order.
    sequence: { concurrent: false },
  },
});
