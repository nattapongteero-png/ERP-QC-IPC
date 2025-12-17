import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Enable experimental features if needed
  experimental: {
    // serverActions are enabled by default in Next.js 14+
  },
};

export default nextConfig;
