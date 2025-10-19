// src/app/(auth)/signup/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import SignupClient from './SignupClient';
import { adminAuth } from '@/lib/firebase-admin';

export default async function Page() {
  const jar = await cookies();
  const session = jar.get('__session')?.value;

  if (session) {
    try {
      // Verify the session cookie. If it's valid, redirect to main.
      await adminAuth.verifySessionCookie(session, true);
      redirect('/main');
    } catch (error) {
      // If the cookie is invalid, let the user proceed to sign up or navigate elsewhere.
      console.log('Invalid session cookie found, showing signup page.');
    }
  }

  return <SignupClient />;
}
