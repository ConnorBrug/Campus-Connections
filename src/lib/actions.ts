'use server';

import { z } from 'zod';
import type { TripRequest, UserGender } from './types';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getUserProfile, saveTripRequest, changePassword, deleteCurrentUserAccount } from './auth';
import { isValid, parse, format, isBefore, addHours, isPast, parseISO } from 'date-fns';
import { adminDb } from './firebase-admin';

/* ----------------------------- Trip schema ----------------------------- */

const TripDetailsSchema = z.object({
  userId: z.string().min(1, 'User ID is required.'),
  university: z.string().min(1, 'University is required.'),
  flightCode: z
    .string()
    .min(3, 'Flight code required (e.g., UA234).')
    .regex(/^[a-zA-Z0-9]+$/, 'Alphanumeric only.'),
  flightDate: z.date({
    required_error: 'Flight date is required.',
    invalid_type_error: "That's not a valid date!",
  }),
  flightHour: z.string().min(1, 'Hour is required.'),
  flightMinute: z.string().min(1, 'Minute is required.'),
  flightPeriod: z.enum(['AM', 'PM'], { required_error: 'AM/PM is required.' }),
  departingAirport: z
    .string()
    .length(3, 'Must be a 3-letter airport code.')
    .regex(/^[a-zA-Z]{3}$/, 'Must be 3 letters for airport code.')
    .transform((value) => value.toUpperCase()),
  numberOfCarryons: z.coerce.number().min(0, 'Cannot be negative.').max(2, 'Max 2 carry-ons.'),
  numberOfCheckedBags: z.coerce.number().min(0, 'Cannot be negative.').max(3, 'Max 3 checked bags.'),
  preferredMatchGender: z.enum(['Male', 'Female', 'No preference'], {
    required_error: 'Please select a preference.',
  }),
  campusArea: z.string().optional(),
});

type TripDetailsFormValues = z.infer<typeof TripDetailsSchema>;

export type TripDetailsFormState = {
  success?: boolean;
  message?: string;
  errors?: {
    flightCode?: string[];
    flightDate?: string[];
    flightTime?: string[];
    departingAirport?: string[];
    numberOfCarryons?: string[];
    numberOfCheckedBags?: string[];
    preferredMatchGender?: string[];
    _form?: string[];
  };
};

const combineFlightTimeParts = (hour: string, minute: string, period: 'AM' | 'PM'): string => {
  let h = parseInt(hour, 10);
  if (period === 'PM' && h !== 12) h += 12;
  else if (period === 'AM' && h === 12) h = 0;
  return `${h.toString().padStart(2, '0')}:${minute}`;
};

/* ------------------- ACTION: submitTripDetailsAction ------------------- */

export async function submitTripDetailsAction(
  _prevState: TripDetailsFormState,
  data: TripDetailsFormValues
): Promise<TripDetailsFormState> {
  try {
    const validated = TripDetailsSchema.safeParse(data);
    if (!validated.success) {
      return {
        success: false,
        message: 'Invalid form data.',
        errors: validated.error.flatten().fieldErrors,
      };
    }

    const {
      userId,
      flightCode,
      flightDate,
      flightHour,
      flightMinute,
      flightPeriod,
      departingAirport,
      numberOfCarryons,
      numberOfCheckedBags,
      university,
      preferredMatchGender,
      campusArea,
    } = validated.data;

    const [currentUser, existingTrip] = await Promise.all([
      getUserProfile(userId),
      getActiveTripForUser(userId),
    ]);

    if (!currentUser) {
      return {
        success: false,
        message: 'You must be logged in to submit a trip.',
        errors: { _form: ['User profile could not be loaded.'] },
      };
    }

    if (currentUser.isBanned) {
      return {
        success: false,
        message: 'Your account is suspended from creating new trips.',
        errors: { _form: ['Account suspended.'] },
      };
    }

    if (existingTrip) {
      return {
        success: false,
        message: 'You already have a pending trip.',
        errors: { _form: ['An active trip already exists.'] },
      };
    }

    const flightTime = combineFlightTimeParts(flightHour, flightMinute, flightPeriod);
    const flightDateTime = parse(
      `${format(flightDate, 'yyyy-MM-dd')}T${flightTime}:00`,
      "yyyy-MM-dd'T'HH:mm:ss",
      new Date()
    );

    if (!isValid(flightDateTime)) {
      return {
        success: false,
        message: 'Invalid date or time.',
        errors: { _form: ['The provided date/time is invalid.'] },
      };
    }

    const threeHoursFromNow = addHours(new Date(), 3);
    if (isBefore(flightDateTime, threeHoursFromNow)) {
      return {
        success: false,
        message: 'Trip must be scheduled at least 3 hours in advance.',
        errors: { _form: ['Please select a flight time at least 3 hours from now.'] },
      };
    }

    // ---- Normalize nullable fields (keeps TS happy) ----
    const safeGender: UserGender = currentUser.gender ?? 'Prefer not to say';
    const safePhotoUrl: string | undefined = currentUser.photoUrl ?? undefined;
    const safeName: string | null = currentUser.name ?? null;
    const safeEmail: string | null = currentUser.email ?? null;

    // --- Save trip (include required nullables) ---
    const userTripRequest: Omit<TripRequest, 'id' | 'createdAt'> = {
      userId: currentUser.id,
      userName: safeName,
      userEmail: safeEmail,
      userPhotoUrl: safePhotoUrl,
      flightCode,
      flightDate: format(flightDate, 'yyyy-MM-dd'),
      flightTime,
      flightDateTime: flightDateTime.toISOString(),
      departingAirport,
      numberOfCarryons,
      numberOfCheckedBags,
      university,
      campusArea,
      status: 'pending',
      userPreferences: preferredMatchGender,
      userGender: safeGender,
      matchId: null,
      matchedUserId: null,
      noMatchWarningSent: false,
      cancellationAlert: false,
    };

    await saveTripRequest(userTripRequest);

    revalidatePath('/dashboard');
    redirect('/trip-submitted');
  } catch {
    return {
      success: false,
      message: 'An unexpected error occurred. Please try again.',
      errors: { _form: ['An internal error prevented the trip from being saved.'] },
    };
  }
}

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
