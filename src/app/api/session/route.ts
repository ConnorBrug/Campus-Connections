import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

const COOKIE_NAME = '__session';

// POST /api/session  -> exchange ID token for a session cookie
export async function POST(req: Request) {
  try {
    const { idToken } = await req.json();
    if (!idToken) {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
    }

    // 5 days (Firebase allows up to 2 weeks; pick what you want)
    const expiresIn = 5 * 24 * 60 * 60 * 1000;

    // (Optionally verify ID token first)
    // await adminAuth.verifyIdToken(idToken);

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
  } catch (e) {
    console.error('POST /api/session failed:', e);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 401 });
  }
}

// DELETE /api/session -> clear the cookie
export async function DELETE() {
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
