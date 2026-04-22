import type { MetadataRoute } from 'next';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://campus-connections.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/dev/',
          '/onboarding',
          '/verify',
          '/verify-email',
          '/forgot-password',
          '/dashboard',
          '/main',
          '/manual-rides',
          '/profile',
          '/trip-submitted',
          '/planned-trips',
          '/chat',
          '/match-found',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
