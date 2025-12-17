import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Instrumentation is enabled by default in Next.js 15+
  // The src/instrumentation.ts file runs on server startup for schema sync
};

export default nextConfig;
