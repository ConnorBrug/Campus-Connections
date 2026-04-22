// src/middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/*
 * Middleware is an optimization, not the source of truth for auth.
 * The real gate is `src/app/(protected)/layout.tsx` which verifies the
 * session cookie via Firebase Admin and redirects unauthenticated users
 * to /login. Middleware just short-circuits that roundtrip for users
 * with no `__session` cookie at all.
 *
 * IMPORTANT: Next.js route-group names (like `(app)`) do NOT appear in
 * the URL, so a matcher like `/(app)(.*)` matches nothing. We enumerate
 * the actual protected URL paths below. When adding a new protected
 * route, add it here as well - the layout will still enforce auth if
 * you forget, so the worst case is one extra server roundtrip.
 */
export const config = {
  matcher: [
    '/main',
    '/dashboard',
    '/manual-rides',
    '/profile',
    '/trip-submitted',
    '/planned-trips',
    '/chat/:path*',
    '/match-found/:path*',
    '/dev/:path*',
    '/onboarding',
  ],
};

export function middleware(req: NextRequest) {
  const hasSession = req.cookies.get('__session');
  if (!hasSession) {
    const url = new URL('/login', req.url);
    url.searchParams.set('next', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
