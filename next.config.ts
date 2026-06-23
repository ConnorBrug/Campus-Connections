// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co", pathname: "/**" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com", pathname: "/**" },
      // Firebase Storage download host for new buckets (*.firebasestorage.app)
      { protocol: "https", hostname: "*.firebasestorage.app", pathname: "/**" },
      // Google OAuth profile photos (lh3.googleusercontent.com)
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
    ],
  },

  // Keep firebase-admin as an external server package
  serverExternalPackages: ["firebase-admin"],

  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com https://login.microsoftonline.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://firebasestorage.googleapis.com https://*.firebasestorage.app https://lh3.googleusercontent.com https://placehold.co",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://firebasestorage.googleapis.com https://*.firebasestorage.app https://firebaseinstallations.googleapis.com wss://*.firebaseio.com https://*.firebaseio.com https://login.microsoftonline.com https://graph.microsoft.com",
      "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://login.microsoftonline.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join('; ');

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
