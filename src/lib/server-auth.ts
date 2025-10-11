'use server';

import { cookies } from 'next/headers';
import { getAdminAuth } from './firebase-admin';

export async function getServerUser() {
  try {
    const auth = getAdminAuth();
    const sessionCookie = cookies().get('__session')?.value;

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

