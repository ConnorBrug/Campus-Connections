import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { isRateLimited } from '@/lib/rate-limit';
import { sanitizeText } from '@/lib/sanitize';
import { assertSameOrigin } from '@/lib/csrf';
import { log } from '@/lib/log';

const COOKIE_NAME = '__session';
const AUTO_BAN_THRESHOLD = 3;

/**
 * POST /api/flags  { flaggedUserId: string, reason: string }
 *
 * Server-side flagging. This used to run on the client via the Firestore SDK,
 * but the security rules (correctly) make `flags` and the `isBanned` field
 * Admin-only, so the client path always failed with permission-denied. This
 * route performs the whole flow with the Admin SDK.
 */
export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (isRateLimited(`flags:${ip}`, 10, 60_000)) {
    return NextResponse.json({ message: 'Too many requests' }, { status: 429 });
  }

  try {
    const store = await cookies();
    const session = store.get(COOKIE_NAME)?.value;
    if (!session) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

    const decoded = await adminAuth.verifySessionCookie(session, true).catch(() => null);
    if (!decoded?.uid) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }
    const flaggerId = decoded.uid;

    const body = (await req.json().catch(() => null)) as
      | { flaggedUserId?: unknown; reason?: unknown }
      | null;
    const flaggedUserId =
      typeof body?.flaggedUserId === 'string' ? body.flaggedUserId : '';
    const reason = sanitizeText(body?.reason, 500);

    if (!flaggedUserId) {
      return NextResponse.json({ message: 'flaggedUserId is required' }, { status: 400 });
    }
    if (!reason) {
      return NextResponse.json({ message: 'A reason is required to submit a flag.' }, { status: 400 });
    }
    if (flaggerId === flaggedUserId) {
      return NextResponse.json({ message: 'You cannot flag yourself.' }, { status: 400 });
    }

    const flaggedRef = adminDb.collection('users').doc(flaggedUserId);
    const flaggedSnap = await flaggedRef.get();
    if (!flaggedSnap.exists) {
      return NextResponse.json({ message: 'User not found.' }, { status: 404 });
    }

    const dupSnap = await adminDb
      .collection('flags')
      .where('flaggerId', '==', flaggerId)
      .where('flaggedUserId', '==', flaggedUserId)
      .limit(1)
      .get();
    if (!dupSnap.empty) {
      return NextResponse.json({ message: 'You have already flagged this user.' }, { status: 409 });
    }

    const batch = adminDb.batch();

    const flagRef = adminDb.collection('flags').doc();
    batch.set(flagRef, {
      flaggerId,
      flaggedUserId,
      reason,
      timestamp: FieldValue.serverTimestamp(),
    });

    batch.update(adminDb.collection('users').doc(flaggerId), {
      flaggedUserIds: FieldValue.arrayUnion(flaggedUserId),
    });

    const flagsSnap = await adminDb
      .collection('flags')
      .where('flaggedUserId', '==', flaggedUserId)
      .get();
    const uniqueFlaggers = new Set<string>(
      flagsSnap.docs
        .map((d) => (d.data() as { flaggerId?: string }).flaggerId)
        .filter((v): v is string => !!v),
    );
    uniqueFlaggers.add(flaggerId);

    let banned = false;
    if (uniqueFlaggers.size >= AUTO_BAN_THRESHOLD) {
      batch.update(flaggedRef, { isBanned: true });
      banned = true;
    }

    await batch.commit();

    log.info('flag.created', { flaggerId, flaggedUserId, uniqueFlaggers: uniqueFlaggers.size, banned });
    return NextResponse.json({ success: true, banned });
  } catch (err) {
    log.error('flag.failed', err);
    return NextResponse.json({ message: 'Failed to submit flag.' }, { status: 500 });
  }
}
