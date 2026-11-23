import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone hanya untuk sandbox/preview; deploy Vercel memakai output default
  output: process.env.STANDALONE === "1" ? "standalone" : undefined,
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
