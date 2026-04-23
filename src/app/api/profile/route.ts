import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { z } from 'zod';
import { isRateLimited } from '@/lib/rate-limit';
import { sanitizeStrict } from '@/lib/sanitize';
import { assertSameOrigin } from '@/lib/csrf';

const BodySchema = z.object({
  name: z.string().min(2).max(80),
  university: z.enum(['Boston College', 'Vanderbilt']),
  gender: z.enum(['Male', 'Female', 'Other', 'Prefer not to say']),
  campusArea: z.string().max(40).optional().default(''),
  // photoUrl must live on our Firebase Storage hosts or Google profile CDN -
  // avoid open redirects or arbitrary external URLs being written to the
  // profile. The host list must stay in sync with the client allowlist in
  // src/lib/auth.ts#PHOTO_URL_HOST_RE and the CSP img-src in next.config.ts.
  photoUrl: z.string().url().refine(
    (u) => /^https:\/\/(firebasestorage\.googleapis\.com|[A-Za-z0-9-]+\.firebasestorage\.app|lh3\.googleusercontent\.com)\//.test(u),
    { message: 'Unsupported photoUrl host' },
  ).optional(),
});

export async function PATCH(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

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

    // Sanitize free-form strings — zod shape/length is not enough to stop
    // control / zero-width / RTL-override tricks that would otherwise sit
    // in Firestore and show up in emails / SMS / chat headers.
    const cleanName = sanitizeStrict(name, 80);
    const cleanCampusArea = university === 'Boston College'
      ? sanitizeStrict(campusArea || '', 40)
      : '';
    if (!cleanName) {
      return NextResponse.json({ message: 'Invalid name' }, { status: 400 });
    }

    const update: Record<string, string> = {
      name: cleanName,
      university,
      gender,
      campusArea: cleanCampusArea,
    };

    // Only set photoUrl if provided (so we don't overwrite with undefined)
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
