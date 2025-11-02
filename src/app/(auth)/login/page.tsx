// src/app/(auth)/login/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import LoginClient from './LoginClient';
import { adminAuth } from '@/lib/firebase-admin'; // assuming you already have this

export default async function Page() {
  const jar = await cookies();
  const session = jar.get('__session')?.value;

  if (session) {
    try {
      await adminAuth.verifySessionCookie(session, true);
      redirect('/main');
    } catch {
      // invalid/expired cookie: fall through
    }
  }
  return <LoginClient />;
}
