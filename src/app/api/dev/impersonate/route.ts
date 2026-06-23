/**
 * Dev-only impersonation endpoint.
 *
 * POST /api/dev/impersonate  { uid: string }
 *   → mints a __session cookie for the target user so the browser is now
 *     signed in as them. Also returns a customToken so the client-side
 *     Firebase SDK can be signed in via signInWithCustomToken.
 *
 * Hard constraints (ALL must hold, or the route 404s):
 *   1. process.env.NODE_ENV === 'development'
 *   2. The target user's /users/{uid} doc exists AND has `synthetic === true`.
 */

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

const COOKIE_NAME = '__session';

export async function POST(req: Request) {
  // Only available in local development. Using `!== 'development'` (rather than
  // `=== 'production'`) means any non-dev environment (staging/test/preview
  // where NODE_ENV may not be 'production') also 404s.
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const body = (await req.json().catch(() => null)) as { uid?: string } | null;
    const uid = body?.uid;
    if (!uid || typeof uid !== 'string') {
      return NextResponse.json({ error: 'uid is required' }, { status: 400 });
    }

    // Belt-and-suspenders: only synthetic users can be impersonated.
    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const data = userDoc.data() ?? {};
    if (data.synthetic !== true) {
      return NextResponse.json(
        { error: 'Refusing to impersonate non-synthetic user' },
        { status: 403 },
      );
    }

    // 1. Make sure the Auth user exists (synthetic users created by the seed
    //    script only write Firestore docs, not Auth users).
    try {
      await adminAuth.createUser({
        uid,
        email: typeof data.email === 'string' ? data.email : `${uid}@example.test`,
        emailVerified: true,
        displayName: typeof data.name === 'string' ? data.name : uid,
      });
    } catch (err) {
      const code = (err as { code?: string } | undefined)?.code;
      if (code !== 'auth/uid-already-exists' && code !== 'auth/email-already-exists') {
        throw err;
      }
    }

    // 2. Custom token → ID token (via REST) → session cookie.
    const customToken = await adminAuth.createCustomToken(uid);
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Server misconfigured: NEXT_PUBLIC_FIREBASE_API_KEY missing' },
        { status: 500 },
      );
    }

    const tokenRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: customToken, returnSecureToken: true }),
      },
    );
    if (!tokenRes.ok) {
      const errBody = await tokenRes.text().catch(() => '');
      console.error('[impersonate] token exchange failed', { status: tokenRes.status, body: errBody });
      return NextResponse.json(
        { error: 'Token exchange failed' },
        { status: 502 },
      );
    }
    const { idToken } = (await tokenRes.json()) as { idToken: string };

    // 3. 5-day session cookie to mirror the normal login flow.
    const expiresIn = 5 * 24 * 60 * 60 * 1000;
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    const res = NextResponse.json({
      ok: true,
      impersonating: uid,
      name: data.name ?? null,
      customToken,
    });
    res.cookies.set({
      name: COOKIE_NAME,
      value: sessionCookie,
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor(expiresIn / 1000),
    });
    return res;
  } catch (err) {
    console.error('POST /api/dev/impersonate error:', err);
    return NextResponse.json(
      { error: 'Impersonation failed' },
      { status: 500 },
    );
  }
}
