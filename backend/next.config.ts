import type { NextConfig } from "next";

// cacheComponents is intentionally off: every Coop page is per-user and
// cookie-authenticated, so there is nothing to prerender into a static shell.
const nextConfig: NextConfig = {
  // The automated-test server (scripts/test-server.mjs) uses its own build folder so it can
  // run next to `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
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
