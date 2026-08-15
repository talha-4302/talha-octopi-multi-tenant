import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    fileParallelism: false,
    poolOptions: { threads: { singleThread: true } },
    setupFiles: ['./tests/setup.js'],
    testTimeout: 20000,
  },
});
