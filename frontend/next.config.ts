import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Required by the multi-stage Dockerfile to run Next.js as a standalone server. */
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
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
