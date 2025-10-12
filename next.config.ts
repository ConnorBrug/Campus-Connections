import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
  experimental: {
    allowedDevOrigins: [
      "https://3000-firebase-studio-1749349277265.cluster-hf4yr35cmnbd4vhbxvfvc6cp5q.cloudworkstations.dev",
      "https://9000-firebase-studio-1749349277265.cluster-hf4yr35cmnbd4vhbxvfvc6cp5q.cloudworkstations.dev",
      "https://3000-firebase-studio-1752880504974.cluster-f4iwdviaqvc2ct6pgytzw4xqy4.cloudworkstations.dev",
      "https://9000-firebase-studio-1752880504974.cluster-f4iwdviaqvc2ct6pgytzw4xqy4.cloudworkstations.dev",
      "https://3001-firebase-studio-1752880504974.cluster-f4iwdviaqvc2ct6pgytzw4xqy4.cloudworkstations.dev", // 👈 new
    ],
  },
  
};

export default nextConfig;
