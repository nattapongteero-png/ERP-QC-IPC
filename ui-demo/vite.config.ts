import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * Static demo build of the QC & IPC criteria screen.
 *
 * It imports the real components from ../src — nothing is copied — and replaces
 * only the two things a static host cannot provide: Next.js navigation and the
 * API. That way the demo cannot drift from the app: if the form changes, the
 * demo changes with it.
 *
 * `base` matches the GitHub Pages project path (https://<user>.github.io/<repo>/).
 */
export default defineConfig({
  root: __dirname,
  base: process.env.DEMO_BASE ?? '/ERP-QC-IPC/',
  plugins: [react()],
  resolve: {
    alias: [
      // DevExtreme is licence-restricted for redistribution; the demo swaps the
      // one component that uses it for a plain equivalent.
      {
        find: /^@\/components\/documents$/,
        replacement: path.resolve(__dirname, 'shims/gmp-document-select.tsx'),
      },
      {
        find: /^@\/components\/shared\/ConfirmDialog$/,
        replacement: path.resolve(__dirname, 'shims/confirm-dialog.tsx'),
      },
      {
        find: /^@\/components\/ui\/dx-button$/,
        replacement: path.resolve(__dirname, 'shims/dx-button.tsx'),
      },
      { find: 'next/navigation', replacement: path.resolve(__dirname, 'shims/next-navigation.tsx') },
      { find: 'next/link', replacement: path.resolve(__dirname, 'shims/next-link.tsx') },
      { find: '@', replacement: path.resolve(__dirname, '../src') },
    ],
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
