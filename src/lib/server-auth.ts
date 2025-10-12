'use server';

import { cookies } from 'next/headers';
import { adminAuth } from './firebase-admin';

export async function getServerUser() {
  try {
    const auth = adminAuth; // ✅ use adminAuth directly
    const cookieStore = await cookies(); // ✅ await cookies()
    const sessionCookie = cookieStore.get('__session')?.value;

    if (!sessionCookie) {
      return null;
    }

    const decoded = await auth.verifySessionCookie(sessionCookie, true);
    return decoded;
  } catch (err) {
    console.error('Error verifying server user:', err);
    return null;
  }
}
