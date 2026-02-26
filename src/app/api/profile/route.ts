import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { z } from 'zod';
import { isRateLimited } from '@/lib/rate-limit';

const BodySchema = z.object({
  name: z.string().min(2),
  university: z.enum(['Boston College', 'Vanderbilt']),
  gender: z.enum(['Male', 'Female', 'Other', 'Prefer not to say']),
  campusArea: z.string().optional().default(''),
  photoUrl: z.string().url().optional(),
});

export async function PATCH(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (isRateLimited(`profile:${ip}`, 10, 60_000)) {
    return NextResponse.json({ message: 'Too many requests' }, { status: 429 });
  }

  try {
    const store = await cookies();
    const session = store.get('__session')?.value;
    if (!session) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

    const { uid } = await adminAuth.verifySessionCookie(session, true);

    const json = await req.json();
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, university, gender, campusArea, photoUrl } = parsed.data;

    const update: Record<string, string> = {
      name,
      university,
      gender,
      campusArea: university === 'Boston College' ? (campusArea || '') : '',
    };

    // Only set photoUrl if provided (so we don’t overwrite with undefined)
    if (photoUrl) {
      update.photoUrl = photoUrl;
    }

    await adminDb.collection('users').doc(uid).update(update);

    return NextResponse.json({ success: true, message: 'Profile updated' });
  } catch (err) {
    console.error('PATCH /api/profile error:', err);
    return NextResponse.json({ message: 'Failed to update profile' }, { status: 500 });
  }
}
