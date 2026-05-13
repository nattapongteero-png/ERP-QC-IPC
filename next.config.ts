import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts');

const nextConfig: NextConfig = {
  output: "standalone",
  // Instrumentation is enabled by default in Next.js 15+
  // The src/instrumentation.ts file runs on server startup for schema sync

  // Include docs/SYSTEM-TOR.md in the standalone output so the
  // GET /api/admin/system-tor-doc route can readFile() it at runtime.
  outputFileTracingIncludes: {
    '/api/admin/system-tor-doc': ['./docs/SYSTEM-TOR.md'],
  },
};

export default withNextIntl(nextConfig);
