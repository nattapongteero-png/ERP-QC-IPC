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
      // The shared barrel re-exports four DevExtreme-backed components that
      // nothing here renders; importing the barrel would ship them anyway.
      {
        find: /^@\/components\/shared$/,
        replacement: path.resolve(__dirname, 'shims/shared-barrel.tsx'),
      },
      {
        find: /^@\/components\/ui\/dx-button$/,
        replacement: path.resolve(__dirname, 'shims/dx-button.tsx'),
      },
      {
        find: /^@\/components\/ui\/dx-popup$/,
        replacement: path.resolve(__dirname, 'shims/dx-popup.tsx'),
      },
      {
        find: /^@\/components\/ui\/dx-data-grid$/,
        replacement: path.resolve(__dirname, 'shims/dx-data-grid.tsx'),
      },
      // The work order screens pull three more DevExtreme inputs; the same
      // redistribution restriction applies, so they resolve to plain ones.
      {
        find: /^@\/components\/ui\/dx-(number-box|text-area|load-indicator)$/,
        replacement: path.resolve(__dirname, 'shims/dx-inputs.tsx'),
      },
      {
        find: /^@\/components\/ui\/dx-tabs$/,
        replacement: path.resolve(__dirname, 'shims/dx-tabs.tsx'),
      },
      {
        find: /^@\/components\/ui\/dx-date-box$/,
        replacement: path.resolve(__dirname, 'shims/dx-date-box.tsx'),
      },
      // Text box, select box, tag box and switch — the QC screens reach for
      // these, and the same redistribution restriction applies.
      {
        find: /^@\/components\/ui\/dx-(text-box|select-box|tag-box|switch)$/,
        replacement: path.resolve(__dirname, 'shims/dx-controls.tsx'),
      },
      // The app shell's language switchers are DevExtreme select boxes.
      {
        find: /^@\/components\/shared\/language-switcher$/,
        replacement: path.resolve(__dirname, 'shims/language-switcher.tsx'),
      },
      {
        find: /^@\/hooks\/use-cached-session$/,
        replacement: path.resolve(__dirname, 'shims/session.tsx'),
      },
      {
        find: /^@\/hooks\/use-vmi-auto-sync$/,
        replacement: path.resolve(__dirname, 'shims/vmi-auto-sync.tsx'),
      },
      // Some screens reach past the app's own dx-* wrappers for the vendor
      // package itself. DevExtreme cannot be redistributed, so every one of its
      // entry points resolves to a plain stand-in. A component with no
      // stand-in fails the build — loud, and better than quietly shipping it.
      {
        find: /^devextreme-react\/(.+)$/,
        replacement: path.resolve(__dirname, 'shims/devextreme-react') + '/$1',
      },
      // Nothing streams in a static demo, and a failed EventSource reconnects
      // for as long as the tab is open.
      {
        find: /^@\/hooks\/use-realtime-topic$/,
        replacement: path.resolve(__dirname, 'shims/realtime-topic.tsx'),
      },
      { find: 'next-intl', replacement: path.resolve(__dirname, 'shims/next-intl.tsx') },
      { find: 'next/navigation', replacement: path.resolve(__dirname, 'shims/next-navigation.tsx') },
      { find: 'next/link', replacement: path.resolve(__dirname, 'shims/next-link.tsx') },
      { find: '@', replacement: path.resolve(__dirname, '../src') },
    ],
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
