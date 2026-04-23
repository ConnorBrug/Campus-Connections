/**
 * Dev-only impersonation endpoint.
 *
 * POST /api/dev/impersonate  { uid: string }
 *   → mints a __session cookie for the target user so the browser is now
 *     signed in as them. Also returns a customToken so the client-side
 *     Firebase SDK can be signed in via signInWithCustomToken (the __session
 *     cookie alone leaves auth.currentUser === null, which breaks any
 *     client-side Firestore read whose rules check request.auth.uid).
 *
 * Hard constraints (ALL must hold, or the route 404s):
 *   1. process.env.NODE_ENV !== 'production'
 *   2. The target user's /users/{uid} doc exists AND has `synthetic === true`.
 *      This guarantees this route can never be used to hijack a real account,
 *      even if something else went wrong in the build.
 *
 * The endpoint is not documented anywhere outside the dev dashboard, but the
 * NODE_ENV gate is the real seatbelt.
 *
 * Flow:
 *   1. Verify env + synthetic flag.
 *   2. Admin SDK: createCustomToken(uid).
 *   3. Exchange the custom token for an ID token via Identity Toolkit REST.
 *   4. createSessionCookie(idToken) → set as __session cookie.
 *   5. Return { ok, impersonating, name, customToken } so the caller can
 *      also sign the client SDK in.
 */

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

const COOKIE_NAME = '__session';

export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
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
    //    script only write Firestore docs, not Auth users). createUser is
    //    idempotent-ish: if it 409s, we fall through to getUser.
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
      // Should be unreachable once env is required at bundle time, but fail
      // loud rather than silently downgrading to a hardcoded value.
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
      // Don't echo Identity Toolkit's error body back to the caller - it
      // can contain internal details. Log server-side, return a generic
      // message.
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

    // Return customToken too so the /dev/test page can sign the *client* SDK
    // in via signInWithCustomToken. Without it only the server __session
    // cookie is set, and client-side Firestore queries (e.g. the dashboard's
    // getActiveTripForUser) get rejected by rules because auth.currentUser
    // is still null.
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
    // Log server-side, return a generic message to the client. Echoing
    // err.message can leak stack-trace-ish details (e.g. "No such file
    // /var/run/secrets/...") from Admin SDK.
    console.error('POST /api/dev/impersonate error:', err);
    return NextResponse.json(
      { error: 'Impersonation failed' },
      { status: 500 },
    );
  }
}
