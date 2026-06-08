import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts');

const nextConfig: NextConfig = {
  output: "standalone",
  // Instrumentation is enabled by default in Next.js 15+
  // The src/instrumentation.ts file runs on server startup for schema sync

  // Type safety is gated separately by `bunx tsc --noEmit --skipLibCheck`
  // (see CLAUDE.md — run before finishing tasks). Next's in-build type-check
  // re-runs the full project tsc, which OOMs the 8GB WSL Docker engine on this
  // machine ("Running TypeScript ..." → engine EOF). Skipping the redundant
  // in-build check keeps Docker builds within memory.
  typescript: {
    ignoreBuildErrors: true,
  },

  // Reduce peak memory during `next build` webpack compile. This machine's
  // WSL Docker backend is RAM-constrained (8GB, shared with other stacks), and
  // the compile intermittently OOM-killed the engine. This trades a little
  // build time for a lower memory ceiling.
  experimental: {
    webpackMemoryOptimizations: true,
  },

  // Premises module re-homing: these page routes moved under /premises/*.
  // Old URLs (bookmarks, in-app links) redirect to the new location. Only page
  // routes are listed here — /api/* is never matched, so API calls are unaffected.
  async redirects() {
    return [
      // QC Entry is the Quality module home (old dashboard removed).
      { source: '/quality', destination: '/quality/qc-entry', permanent: false },
      { source: '/inventory/storage-monitoring', destination: '/premises/storage-monitoring', permanent: false },
      { source: '/environmental', destination: '/premises/environmental/inspections', permanent: false },
      { source: '/environmental/:path*', destination: '/premises/environmental/:path*', permanent: false },
      { source: '/gmp/sanitation', destination: '/premises/sanitation', permanent: false },
      { source: '/gmp/sanitation/:path*', destination: '/premises/sanitation/:path*', permanent: false },
      // Maintenance calendar merged into the notifications page (List/Calendar toggle).
      { source: '/premises/notifications/calendar', destination: '/premises/notifications', permanent: false },
      { source: '/notifications', destination: '/premises/notifications', permanent: false },
      { source: '/notifications/calendar', destination: '/premises/notifications', permanent: false },
      { source: '/notifications/:path*', destination: '/premises/notifications/:path*', permanent: false },
    ];
  },
};

export default withNextIntl(nextConfig);
