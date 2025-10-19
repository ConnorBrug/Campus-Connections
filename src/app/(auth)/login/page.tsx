// src/app/(auth)/login/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import LoginClient from './LoginClient';
import { adminAuth } from '@/lib/firebase-admin';

export default async function Page() {
  const jar = await cookies();
  const session = jar.get('__session')?.value;
  
  if (session) {
    try {
      // Verify the session cookie. If it's valid, redirect to main.
      // This is a more robust check than just seeing if the cookie exists.
      await adminAuth.verifySessionCookie(session, true);
      redirect('/main');
    } catch (error) {
      // If the cookie is invalid (expired, etc.), do nothing and let the user log in.
      console.log('Invalid session cookie found, showing login page.');
    }
  }

  return <LoginClient />;
}
