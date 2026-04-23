import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { isRateLimited } from '@/lib/rate-limit';
import { assertSameOrigin } from '@/lib/csrf';

const COOKIE_NAME = '__session';

// POST /api/session  -> exchange ID token for a session cookie
export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (isRateLimited(`session:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const { idToken } = await req.json();
    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
    }

    // Verify the ID token BEFORE minting a session cookie. This:
    //  - rejects tampered / expired tokens,
    //  - forces the token to be freshly minted (2nd arg = checkRevoked),
    //  - lets us enforce email verification before the user gets a cookie.
    // `createSessionCookie` does not itself gate on email_verified.
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(idToken, true);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (!decoded.email_verified) {
      return NextResponse.json(
        { error: 'Email not verified' },
        { status: 403 },
      );
    }

    // Require the ID token to be freshly issued (<= 5 min old). This
    // guarantees the user recently proved possession of their password or
    // OAuth session, matching Firebase's own recommendation for cookie
    // creation.
    const authTimeMs = (decoded.auth_time ?? 0) * 1000;
    if (!authTimeMs || Date.now() - authTimeMs > 5 * 60 * 1000) {
      return NextResponse.json(
        { error: 'Recent sign-in required' },
        { status: 401 },
      );
    }

    // 5 days (Firebase allows up to 2 weeks; pick what you want)
    const expiresIn = 5 * 24 * 60 * 60 * 1000;

    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    const res = NextResponse.json({ ok: true });
    res.cookies.set({
      name: COOKIE_NAME,
      value: sessionCookie,
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development', // false in dev
      sameSite: 'lax',
      path: '/',                       // send for all routes
      maxAge: Math.floor(expiresIn / 1000),
    });
    return res;
  } catch (err) {
    console.error('POST /api/session error:', err);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 401 });
  }
}

// DELETE /api/session -> clear the cookie
export async function DELETE(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
