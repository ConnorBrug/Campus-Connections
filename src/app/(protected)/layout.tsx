import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { Header } from '@/components/core/Header';
import AppClientProvider from '@/components/providers/AppClientProvider';

export const runtime = 'nodejs';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const cookie = (await cookies()).get('__session')?.value;
  if (!cookie) redirect('/login');

  let uid = '';
  let emailVerified = false;
  try {
    const decoded = await adminAuth.verifySessionCookie(cookie, true);
    uid = decoded.uid;
    emailVerified = !!decoded.email_verified;
  } catch {
    redirect('/login');
  }

  if (!emailVerified) redirect('/verify-email');

  let initialProfile: any = null;
  if (uid) {
    const snap = await adminDb.collection('users').doc(uid).get();
    if (snap.exists) initialProfile = snap.data();
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <AppClientProvider initialProfile={initialProfile}>
        <main className="flex flex-1 flex-col">{children}</main>
      </AppClientProvider>
    </div>
  );
}
