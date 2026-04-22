// Dev-only endpoint: deletes every tripRequest and user flagged synthetic:true.
// Returns 404 in production so it doesn't exist in the routing table.

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const trips = await adminDb.collection('tripRequests').where('synthetic', '==', true).get();
    let tripCount = 0;
    {
      let batch = adminDb.batch();
      for (const doc of trips.docs) {
        batch.delete(doc.ref);
        tripCount++;
        if (tripCount % 400 === 0) {
          await batch.commit();
          batch = adminDb.batch();
        }
      }
      await batch.commit();
    }

    const users = await adminDb.collection('users').where('synthetic', '==', true).get();
    let userCount = 0;
    {
      let batch = adminDb.batch();
      for (const doc of users.docs) {
        batch.delete(doc.ref);
        userCount++;
        if (userCount % 400 === 0) {
          await batch.commit();
          batch = adminDb.batch();
        }
      }
      await batch.commit();
    }

    return NextResponse.json({ ok: true, deletedTrips: tripCount, deletedUsers: userCount });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Clean failed' },
      { status: 500 },
    );
  }
}
