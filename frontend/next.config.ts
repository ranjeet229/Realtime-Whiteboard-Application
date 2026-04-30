import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Browsers request /favicon.ico; serve the SVG from public without a generated route. */
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/favicon.svg" }];
  },
};

export default nextConfig;
