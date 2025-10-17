// next.config.ts
import type { NextConfig } from "next";

// Read comma-separated origins from env to allow other dev UIs (e.g. Firebase Studio)
// to fetch /_next/* assets from your Next dev server.
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

  // Next 15 replacement for the removed experimental.serverComponentsExternalPackages
  serverExternalPackages: [
    "firebase-admin",
    // add other server-only deps if needed
  ],

  // Silence Next’s dev cross-origin warnings (use .env to list studio origins)
  allowedDevOrigins: allowedFromEnv,
};

export default nextConfig;
