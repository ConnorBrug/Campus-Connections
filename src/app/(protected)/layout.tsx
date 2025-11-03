import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { Header } from '@/components/core/Header';
import AppClientProvider from '@/components/providers/AppClientProvider';

export const runtime = 'nodejs';

function profileIsIncomplete(p: any): boolean {
  if (!p) return true;

  // must have grad year
  if (!p.graduationYear) return true;

  // must have valid gender
  const VALID = ['Male', 'Female', 'Other', 'Prefer not to say'];
  if (!p.gender || !VALID.includes(p.gender)) return true;

  // BC requires campusArea
  if (p.university === 'Boston College' && !p.campusArea) return true;

  // require first + last name
  const tokens = (p.name || '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return true;

  return false;
}

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

  // 🚧 force onboarding if incomplete
  if (profileIsIncomplete(initialProfile)) {
    redirect('/onboarding');
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
