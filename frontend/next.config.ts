import type { NextConfig } from "next";

const publicApi = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";
if (process.env.VERCEL) {
  const looksLocal =
    !publicApi ||
    /localhost|127\.0\.0\.1/i.test(publicApi);
  if (looksLocal) {
    throw new Error(
      "Set NEXT_PUBLIC_API_URL in Vercel → Project → Settings → Environment Variables " +
        "to your Render API base (e.g. https://your-service.onrender.com). " +
        "Redeploy after saving. Localhost is not reachable from the browser on Vercel."
    );
  }
}

const nextConfig: NextConfig = {
  /** Browsers request /favicon.ico; serve the SVG from public without a generated route. */
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/favicon.svg" }];
  },
};

export default nextConfig;
