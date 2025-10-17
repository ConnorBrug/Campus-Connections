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

  // Replaces deprecated experimental.serverComponentsExternalPackages
  serverExternalPackages: ["firebase-admin"],

  // Dev-only: allow Firebase Studio preview origins (replace with your exact hosts if needed)
  allowedDevOrigins: [
    "https://6000-firebase-studio-1752880504974.cluster-f4iwdviaqvc2ct6pgytzw4xqy4.cloudworkstations.dev",
    "https://9000-firebase-studio-1752880504974.cluster-f4iwdviaqvc2ct6pgytzw4xqy4.cloudworkstations.dev",
  ],
};

export default nextConfig;
