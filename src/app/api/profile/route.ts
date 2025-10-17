import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { z } from 'zod';

const BodySchema = z.object({
  name: z.string().min(2),
  university: z.enum(['Boston College', 'Vanderbilt']),
  gender: z.enum(['Male', 'Female', 'Other', 'Prefer not to say']),
  campusArea: z.string().optional().default(''),
  photoUrl: z.string().url().optional(),
});

export async function PATCH(req: Request) {
  try {
    const store = await cookies();
    const session = store.get('__session')?.value;
    if (!session) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });

    const { uid } = await adminAuth.verifySessionCookie(session, true);

    const json = await req.json();
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ message: 'Validation failed', errors: parsed.error.flatten() }, { status: 400 });
    }

    const { name, university, gender, campusArea, photoUrl } = parsed.data;

    const update: any = { name, university, gender };
    if (university === 'Boston College') update.campusArea = campusArea || '';
    else update.campusArea = '';

    if (photoUrl) update.photoUrl = photoUrl;

    await adminDb.collection('users').doc(uid).update(update);
    return NextResponse.json({ success: true, message: 'Profile updated' });
  } catch (e) {
    console.error('[profile PATCH] error:', e);
    return NextResponse.json({ message: 'Failed to update profile' }, { status: 500 });
  }
}
