import { defineConfig } from 'vitest/config';
import path from 'path';
import os from 'os';
import react from '@vitejs/plugin-react';

// Two .ts tests render React components, so they need jsdom despite the .ts
// extension. All other .ts tests are API/service/unit tests that run fine (and
// ~2.6s/file faster) in the lightweight node environment. .tsx tests are UI
// tests and always need jsdom.
const JSDOM_TS_TESTS = [
  'tests/e2e/sales-order-fulfillment.test.ts',
  'tests/unit/hooks/use-vmi-auto-sync.test.ts',
];

// RAM-bound worker sizing. Each vitest fork loads the full module graph
// (Next + Drizzle + DevExtreme + ...) and costs roughly ~0.6 GB. This machine
// has 16 GB but routinely runs the dev container + UAT stack alongside, so
// free RAM is often ~2 GB. Capping workers by *current* free memory keeps a
// test run from pushing the machine into swap (the real cause of "vitest is
// slow" — swap thrash, not CPU). When RAM is free it scales back up.
const PER_WORKER_GB = 0.6;
const freeGB = os.freemem() / 1024 ** 3;
const byRam = Math.max(1, Math.floor(freeGB / PER_WORKER_GB));
const byCpu = Math.max(1, os.cpus().length - 2); // leave 2 cores for OS/Docker
// Ceiling raised 6 -> 12: this machine is a 16-core / 24 GB box, not the 16 GB
// one the original cap assumed. `byRam` still throttles down under memory
// pressure (each fork ~0.6 GB), so this only lets a well-resourced machine use
// the cores it actually has — a low-RAM machine still lands well under 12.
const WORKERS = Math.min(byCpu, byRam, 12);

// We run vitest under Bun (no Node on the build machines). Bun's CJS interop
// hands vite a namespace object for zod that has `default` but no named `z`, so
// ANY test importing a src module that does `import { z } from 'zod'` died at
// import time with "undefined is not an object (evaluating '...z.object')" —
// which is why API-route tests could only ever assert on hand-written response
// shapes. Inlining makes vite transform zod's own ESM, restoring named exports.
const INLINE_DEPS = ['zod'];

export default defineConfig({
  test: {
    globals: true,
    // Adaptive: min(cpu-2, freeRAM/0.6GB, 6). See note above — RAM is the
    // binding constraint here, so fewer workers under memory pressure is
    // actually *faster* (avoids swap) than oversubscribing.
    maxWorkers: WORKERS,
    minWorkers: 1,
    // Cap each fork's heap so one runaway test can't balloon the machine into
    // swap; forks (not threads) keep better-sqlite3's native addon stable.
    poolOptions: {
      forks: { maxForks: WORKERS, minForks: 1 },
    },
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
          server: { deps: { inline: INLINE_DEPS } },
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
          server: { deps: { inline: INLINE_DEPS } },
        },
      },
    ],
  },
});
