import { defineConfig } from 'vitest/config';
import path from 'path';
import react from '@vitejs/plugin-react';

// Two .ts tests render React components, so they need jsdom despite the .ts
// extension. All other .ts tests are API/service/unit tests that run fine (and
// ~2.6s/file faster) in the lightweight node environment. .tsx tests are UI
// tests and always need jsdom.
const JSDOM_TS_TESTS = [
  'tests/e2e/sales-order-fulfillment.test.ts',
  'tests/unit/hooks/use-vmi-auto-sync.test.ts',
];

export default defineConfig({
  test: {
    globals: true,
    // 8-core machine: 6 workers leaves headroom for the OS and avoids the
    // RAM thrashing the old maxWorkers: 16 (2x oversubscription) caused.
    maxWorkers: 6,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/'],
    },
    // Split by environment: node (fast) for non-UI .ts tests, jsdom for the
    // UI tests that actually touch the DOM. Avoids paying ~2.6s jsdom setup
    // on every one of the ~240 API/service test files.
    projects: [
      {
        plugins: [react()],
        resolve: { alias: { '@': path.resolve(__dirname, './src') } },
        test: {
          name: 'node',
          environment: 'node',
          globals: true,
          setupFiles: ['./tests/setup.ts'],
          include: ['tests/**/*.test.ts'],
          exclude: JSDOM_TS_TESTS,
          sequence: { shuffle: false },
        },
      },
      {
        plugins: [react()],
        resolve: { alias: { '@': path.resolve(__dirname, './src') } },
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./tests/setup.ts'],
          include: ['tests/**/*.test.tsx', ...JSDOM_TS_TESTS],
          sequence: { shuffle: false },
        },
      },
    ],
  },
});
