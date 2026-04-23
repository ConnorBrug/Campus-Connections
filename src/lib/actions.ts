'use server';

import { z } from 'zod';
import type { TripRequest } from './types';
import { changePassword, deleteCurrentUserAccount } from './auth';
import { addHours, isPast, parseISO } from 'date-fns';
import { adminDb } from './firebase-admin';

/* --------------------------------------------------------------------
 * The `submitTripDetailsAction` server-action that used to live here was
 * removed because it trusted a client-provided `userId` field and wrote
 * trips under that ID without cross-checking the session cookie. The
 * canonical path is now `POST /api/trips`, which reads `userId` from
 * `verifySessionCookie(...)` and is rate-limited + sanitized.
 *
 * If you need a server-action wrapper in the future, make it a thin
 * proxy over the API route rather than re-implementing the logic.
 * ------------------------------------------------------------------ */

/* ------------------- Server getActiveTripForUser ------------------- */

export async function getActiveTripForUser(userId: string): Promise<TripRequest | null> {
  try {
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
 *
 * The server-action that used to live here (`cancelTripAction`) was
 * removed because it diverged from the API route in several ways:
 *  - It deleted matched trips instead of soft-cancelling (losing
 *    the cancellation record needed for moderation).
 *  - It did not require a reason when leaving a match.
 *  - It was not rate-limited.
 *  - It only handled 2-person matches (requestIds index 0/1).
 * Nothing in the client was using it, so it was safe to drop. If you
 * need a server-action wrapper in the future, make it a thin proxy
 * over the API route rather than re-implementing the logic.
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
