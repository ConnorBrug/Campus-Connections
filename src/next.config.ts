// next.config.ts
import type { NextConfig } from "next";

const allowedFromEnv =
  (process.env.ALLOWED_DEV_ORIGINS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co", pathname: "/**" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com", pathname: "/**" },
    ],
  },

  // correct for Next 15
  serverExternalPackages: ["firebase-admin"],

  // quiets the Studio cross-origin dev noise
  allowedDevOrigins: allowedFromEnv,
};

export default nextConfig;
