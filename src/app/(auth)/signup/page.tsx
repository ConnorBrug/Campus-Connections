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
      await adminAuth.verifySessionCookie(session, true);
      redirect('/main');
    } catch {
      console.log('Invalid session cookie found, showing signup page.');
    }
  }

  return (
    <main className="flex flex-col items-center justify-center py-10 px-4">
      <SignupClient />
    </main>
  );
}
