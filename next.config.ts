// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co", pathname: "/**" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com", pathname: "/**" },
    ],
  },

  // ✅ new key (replaces experimental.serverComponentsExternalPackages)
  serverExternalPackages: ["firebase-admin"],

  // ✅ allow Firebase Studio preview origins only in development
  ...(process.env.NODE_ENV !== "production" && {
    allowedDevOrigins: [
      "9002-firebase-studio-1752880504974.cluster-f4iwdviaqvc2ct6pgytzw4xqy4.cloudworkstations.dev",
      "https://6000-firebase-studio-1752880504974.cluster-f4iwdviaqvc2ct6pgytzw4xqy4.cloudworkstations.dev",
      "https://9000-firebase-studio-1752880504974.cluster-f4iwdviaqvc2ct6pgytzw4xqy4.cloudworkstations.dev",
    ],
  }),

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
