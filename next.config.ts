// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co", pathname: "/**" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com", pathname: "/**" },
    ],
  },

  // ✅ new key (replaces experimental.serverComponentsExternalPackages)
  serverExternalPackages: ["firebase-admin"],

  // ✅ allow Firebase Studio preview origins (update these to match your logs)
  allowedDevOrigins: [
    "9002-firebase-studio-1752880504974.cluster-f4iwdviaqvc2ct6pgytzw4xqy4.cloudworkstations.dev",
    "https://6000-firebase-studio-1752880504974.cluster-f4iwdviaqvc2ct6pgytzw4xqy4.cloudworkstations.dev",
    "https://9000-firebase-studio-1752880504974.cluster-f4iwdviaqvc2ct6pgytzw4xqy4.cloudworkstations.dev",
  ],
};

export default nextConfig;
