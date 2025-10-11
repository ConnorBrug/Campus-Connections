import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const { idToken } = await req.json();

    if (!idToken) {
      return NextResponse.json({ error: 'Missing ID token' }, { status: 400 });
    }

    const auth = getAdminAuth();
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days

    // Create a secure session cookie from the ID token
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });

    // Set the cookie in the user's browser
    cookies().set('__session', sessionCookie, {
      maxAge: expiresIn / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error creating session cookie:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    // Clear the cookie on logout
    cookies().set('__session', '', { maxAge: 0, path: '/' });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing session cookie:', error);
    return NextResponse.json({ error: 'Failed to clear session' }, { status: 500 });
  }
}
