'use server';

import { z } from 'zod';
import type { TripRequest } from './types';
import { changePassword, deleteCurrentUserAccount } from './auth';
import { addHours, isPast, parseISO } from 'date-fns';
import { adminDb } from './firebase-admin';
import { getServerUser } from './server-auth';

/* --------------------------------------------------------------------
 * The `submitTripDetailsAction` server-action that used to live here was
 * removed because it trusted a client-provided `userId` field and wrote
 * trips under that ID without cross-checking the session cookie. The
 * canonical path is now `POST /api/trips`, which reads `userId` from
 * `verifySessionCookie(...)` and is rate-limited + sanitized.
 * ------------------------------------------------------------------ */

/* ------------------- Server getActiveTripForUser -------------------
 * SECURITY: this is a server action (a public RPC endpoint). It must NEVER
 * trust a client-supplied user id — doing so was an IDOR that leaked any
 * user's email + flight schedule. The caller is identified solely by the
 * session cookie. The optional argument is ignored and kept only so existing
 * call sites compile unchanged. */

export async function getActiveTripForUser(_ignoredUserId?: string): Promise<TripRequest | null> {
  try {
    const session = await getServerUser();
    if (!session?.uid) return null;
    const userId = session.uid;

    const tripsRef = adminDb.collection('tripRequests');

    const q = tripsRef
      .where('userId', '==', userId)
      .where('status', 'in', ['pending', 'matched'])
      .limit(1);

    const querySnapshot = await q.get();

    if (querySnapshot.empty) return null;

    const trip = querySnapshot.docs[0].data() as TripRequest;

    if (trip.flightDateTime) {
      const dt = parseISO(trip.flightDateTime);
      if (isPast(addHours(dt, 4))) return null;
    }

    return trip;
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    const code = (error as { code?: number })?.code;
    if (
      code === 5 ||
      msg.includes('NOT_FOUND') ||
      msg.includes('Could not refresh access token')
    ) {
      return null;
    }
    throw new Error(msg || 'Failed to fetch active trip. Please try again later.');
  }
}

/* --------------------------------------------------------------------
 * Canonical cancel path: POST /api/trips/[id]/cancel
 * The server-action that used to live here (`cancelTripAction`) was removed
 * because it diverged from the API route. Use the API route instead.
 * ------------------------------------------------------------------ */

/* ----------------------- changePasswordAction ----------------------- */

const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required.'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters.'),
    confirmNewPassword: z.string(),
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: 'New password must be different from the current one.',
    path: ['newPassword'],
  })
  .refine((d) => d.newPassword === d.confirmNewPassword, {
    message: "New passwords don't match",
    path: ['confirmNewPassword'],
  });

export type ChangePasswordFormState = {
  message?: string;
  errors?: {
    currentPassword?: string[];
    newPassword?: string[];
    confirmNewPassword?: string[];
    _form?: string[];
  };
};

export async function changePasswordAction(
  _prev: ChangePasswordFormState,
  formData: FormData
): Promise<ChangePasswordFormState> {
  const validated = ChangePasswordSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!validated.success) return { errors: validated.error.flatten().fieldErrors };

  const { currentPassword, newPassword } = validated.data;

  try {
    await changePassword(currentPassword, newPassword);
    return { message: 'Your password has been changed successfully. You will be logged out.' };
  } catch (error) {
    const code = (error as { code?: string })?.code;
    const errorMessage = (code === 'auth/wrong-password' || code === 'auth/invalid-credential')
      ? 'The current password you entered is incorrect.'
      : 'Failed to change password. Please try again.';
    return { errors: { _form: [errorMessage] } };
  }
}

/* ----------------------- deleteAccountAction ----------------------- */

export async function deleteAccountAction(): Promise<{ success: boolean; message: string }> {
  try {
    await deleteCurrentUserAccount();
    return { success: true, message: 'Account deleted successfully.' };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'An unexpected error occurred while deleting your account.',
    };
  }
}
