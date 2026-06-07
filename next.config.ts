import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts');

const nextConfig: NextConfig = {
  output: "standalone",
  // Instrumentation is enabled by default in Next.js 15+
  // The src/instrumentation.ts file runs on server startup for schema sync

  // Premises module re-homing: these page routes moved under /premises/*.
  // Old URLs (bookmarks, in-app links) redirect to the new location. Only page
  // routes are listed here — /api/* is never matched, so API calls are unaffected.
  async redirects() {
    return [
      { source: '/inventory/storage-monitoring', destination: '/premises/storage-monitoring', permanent: false },
      { source: '/environmental', destination: '/premises/environmental/inspections', permanent: false },
      { source: '/environmental/:path*', destination: '/premises/environmental/:path*', permanent: false },
      { source: '/gmp/sanitation', destination: '/premises/sanitation', permanent: false },
      { source: '/gmp/sanitation/:path*', destination: '/premises/sanitation/:path*', permanent: false },
      { source: '/notifications', destination: '/premises/notifications', permanent: false },
      { source: '/notifications/:path*', destination: '/premises/notifications/:path*', permanent: false },
    ];
  },
};

export default withNextIntl(nextConfig);
