import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
    hideLogsAfterAbort: true,
  },

  cacheComponents: true,
  partialPrefetching: true,

  outputFileTracingIncludes: {
    "/*": ["./app/generated/prisma/**/*"],
  },

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