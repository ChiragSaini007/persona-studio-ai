import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The repo's own build (vinext) doesn't type-check; skip it for the Vercel build.
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
