import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, adminDb, adminStorage } from '@/lib/firebase-admin';
import { isRateLimitedDurable } from '@/lib/rate-limit';
import { assertSameOrigin } from '@/lib/csrf';
import { log } from '@/lib/log';

const COOKIE_NAME = '__session';

/**
 * POST /api/account/delete
 *
 * Deletes the caller's account and CASCADES to all related data so we don't
 * leave orphaned docs, stranded match partners, or PII in Storage.
 */
export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (await isRateLimitedDurable(`delete:${ip}`, 3, 60_000)) {
    return NextResponse.json({ message: 'Too many requests' }, { status: 429 });
  }

  try {
    const store = await cookies();
    const session = store.get(COOKIE_NAME)?.value;
    if (!session) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });

    const decoded = await adminAuth.verifySessionCookie(session, true).catch(() => null);
    if (!decoded?.uid) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    const uid = decoded.uid;

    // ---- the user's own trips, repooling any stranded partner ----
    const myTripsSnap = await adminDb
      .collection('tripRequests')
      .where('userId', '==', uid)
      .get();

    const matchIds = new Set<string>();
    for (const d of myTripsSnap.docs) {
      const t = d.data() as { status?: string; matchId?: string | null };
      if (t.status === 'matched' && t.matchId) matchIds.add(t.matchId);
    }

    let batch = adminDb.batch();
    let ops = 0;
    const flush = async () => {
      if (ops > 0) {
        await batch.commit();
        batch = adminDb.batch();
        ops = 0;
      }
    };
    const queue = async (fn: (b: FirebaseFirestore.WriteBatch) => void) => {
      fn(batch);
      if (++ops >= 400) await flush();
    };

    // Repool partners on each match the user was part of.
    for (const matchId of matchIds) {
      const partnersSnap = await adminDb
        .collection('tripRequests')
        .where('matchId', '==', matchId)
        .get();
      for (const p of partnersSnap.docs) {
        if ((p.data() as { userId?: string }).userId === uid) continue;
        await queue((b) =>
          b.update(p.ref, { status: 'pending', matchId: null, cancellationAlert: true }),
        );
      }
    }

    // Delete the user's own trips.
    for (const d of myTripsSnap.docs) {
      await queue((b) => b.delete(d.ref));
    }

    // Matches the user participated in.
    const matchesSnap = await adminDb
      .collection('matches')
      .where('participantIds', 'array-contains', uid)
      .get();
    for (const m of matchesSnap.docs) {
      await queue((b) => b.delete(m.ref));
    }

    // Flags (by or against) + cancellations.
    const [flagsBy, flagsAgainst, cancellations] = await Promise.all([
      adminDb.collection('flags').where('flaggerId', '==', uid).get(),
      adminDb.collection('flags').where('flaggedUserId', '==', uid).get(),
      adminDb.collection('cancellations').where('userId', '==', uid).get(),
    ]);
    for (const d of [...flagsBy.docs, ...flagsAgainst.docs, ...cancellations.docs]) {
      await queue((b) => b.delete(d.ref));
    }

    await flush();

    // Chats (with message subcollections). chatId is the sorted join of
    // participant uids; query by membership and recursively delete.
    const chatsSnap = await adminDb
      .collection('chats')
      .where('userIds', 'array-contains', uid)
      .get();
    for (const c of chatsSnap.docs) {
      await adminDb.recursiveDelete(c.ref).catch((e) => {
        log.error('account.delete.chat_failed', e, { chatId: c.id });
      });
    }

    // Storage profile photos.
    try {
      const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
      const bucket = bucketName ? adminStorage.bucket(bucketName) : adminStorage.bucket();
      await bucket.deleteFiles({ prefix: `profile-photos/${uid}/` });
    } catch (e) {
      log.error('account.delete.storage_failed', e, { uid });
    }

    // User doc + Auth user.
    await adminDb.collection('users').doc(uid).delete().catch(() => {});
    await adminAuth.deleteUser(uid);

    log.info('account.deleted', { uid, repooledMatches: matchIds.size, deletedMatches: matchesSnap.size });
    return NextResponse.json({ success: true, message: 'Account deleted' });
  } catch (err) {
    log.error('account.delete.failed', err);
    return NextResponse.json({ message: 'Failed to delete account' }, { status: 500 });
  }
}
