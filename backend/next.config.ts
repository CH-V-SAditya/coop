import type { NextConfig } from "next";

// cacheComponents is intentionally off: every Coop page is per-user and
// cookie-authenticated, so there is nothing to prerender into a static shell.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
