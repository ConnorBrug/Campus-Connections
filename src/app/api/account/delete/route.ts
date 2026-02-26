import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { isRateLimited } from '@/lib/rate-limit';

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (isRateLimited(`delete:${ip}`, 3, 60_000)) {
    return NextResponse.json({ message: 'Too many requests' }, { status: 429 });
  }

  try {
    const store = await cookies();
    const session = store.get('__session')?.value;
    if (!session) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });

    const { uid } = await adminAuth.verifySessionCookie(session, true);

    // Remove user doc
    await adminDb.collection('users').doc(uid).delete().catch(() => {});
    // Optionally: clean up their trips
    const q = await adminDb.collection('tripRequests').where('userId', '==', uid).get();
    const batch = adminDb.batch();
    q.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    // Delete auth user
    await adminAuth.deleteUser(uid);

    return NextResponse.json({ success: true, message: 'Account deleted' });
  } catch (err) {
    console.error('POST /api/account/delete error:', err);
    return NextResponse.json({ message: 'Failed to delete account' }, { status: 500 });
  }
}
