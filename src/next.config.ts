import type { NextConfig } from "next";

const devOrigins = [
  // Your exact Firebase Studio / Cloud Workstations preview hosts
  "https://9000-firebase-studio-1752880504974.cluster-f4iwdviaqvc2ct6pgytzw4xqy4.cloudworkstations.dev",
  "https://6000-firebase-studio-1752880504974.cluster-f4iwdviaqvc2ct6pgytzw4xqy4.cloudworkstations.dev",
  "https://9000-firebase-studio-1752880504974.cluster-f4iwdviaqvc2ct6pgytzw4xqy4.cloudworkstations.dev",

  // Handy wildcard for other similar preview hosts (ignored by runtime; used only below if needed)
  /\.cloudworkstations\.dev$/,
];

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
};

// Some Next versions read `allowedDevOrigins` at the **root** in dev,
// but the TypeScript types don’t include it yet. Attach it with `as any`:
(Object.assign(nextConfig as any, {
  allowedDevOrigins: devOrigins.filter((o) => typeof o === "string"),
})) as NextConfig;

export default nextConfig;
