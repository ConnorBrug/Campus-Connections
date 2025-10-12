
'use server';

import { z } from 'zod';
import type { UserProfile, TripRequest } from './types';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getUserProfile, saveTripRequest, getTripById, updateUserProfile, changePassword, deleteCurrentUserAccount, uploadProfilePhoto } from './auth';
import { isValid, parse, format, isBefore, addHours, isPast, parseISO } from 'date-fns';
import { cookies } from 'next/headers';
import { adminDb } from './firebase-admin';
import { getServerUser } from './server-auth';


const TripDetailsSchema = z.object({
  userId: z.string().min(1, "User ID is required."),
  university: z.string().min(1, "University is required."),
  flightCode: z.string().min(3, "Flight code required (e.g., UA234).").regex(/^[a-zA-Z0-9]+$/, "Alphanumeric only."),
  flightDate: z.date({
    required_error: "Flight date is required.",
    invalid_type_error: "That's not a valid date!",
  }),
  flightHour: z.string().min(1, "Hour is required."),
  flightMinute: z.string().min(1, "Minute is required."),
  flightPeriod: z.enum(['AM', 'PM'], { required_error: "AM/PM is required." }),
  departingAirport: z.string().length(3, "Must be a 3-letter airport code.").regex(/^[a-zA-Z]{3}$/, "Must be 3 letters for airport code.").transform(value => value.toUpperCase()),
  numberOfCarryons: z.coerce.number().min(0, "Cannot be negative.").max(2, "Max 2 carry-ons."),
  numberOfCheckedBags: z.coerce.number().min(0, "Cannot be negative.").max(3, "Max 3 checked bags."),
  preferredMatchGender: z.enum(['Male', 'Female', 'No preference'], { required_error: "Please select a preference." }),
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
  if (period === 'PM' && h !== 12) {
    h += 12;
  } else if (period === 'AM' && h === 12) {
    h = 0;
  }
  return `${h.toString().padStart(2, '0')}:${minute}`;
};

// --- ACTION: SUBMIT TRIP DETAILS (Deferred Matching) ---
export async function submitTripDetailsAction(
  prevState: TripDetailsFormState,
  data: TripDetailsFormValues
): Promise<TripDetailsFormState> {
  console.log("🟢 submitTripDetailsAction called with data:", data);

  try {
    const validatedFields = TripDetailsSchema.safeParse(data);

    if (!validatedFields.success) {
      return {
        success: false,
        message: "Invalid form data.",
        errors: validatedFields.error.flatten().fieldErrors,
      };
    }

    const { userId, flightCode, flightDate, flightHour, flightMinute, flightPeriod, departingAirport, numberOfCarryons, numberOfCheckedBags, university, preferredMatchGender, campusArea } = validatedFields.data;

    const [currentUser, existingTrip] = await Promise.all([
      getUserProfile(userId),
      getActiveTripForUser(userId),
    ]);

    if (!currentUser) {
      return {
        success: false,
        message: "You must be logged in to submit a trip.",
        errors: { _form: ["User profile could not be loaded."] },
      };
    }

    if (currentUser.isBanned) {
      return {
        success: false,
        message: "Your account is suspended from creating new trips.",
        errors: { _form: ["Account suspended."] },
      };
    }

    if (existingTrip) {
      return {
        success: false,
        message: "You already have a pending trip.",
        errors: { _form: ["An active trip already exists."] },
      };
    }

    const flightTime = combineFlightTimeParts(flightHour, flightMinute, flightPeriod);
    const flightDateTime = parse(
      `${format(flightDate, "yyyy-MM-dd")}T${flightTime}:00`,
      "yyyy-MM-dd'T'HH:mm:ss",
      new Date()
    );

    if (!isValid(flightDateTime)) {
      return {
        success: false,
        message: "Invalid date or time.",
        errors: { _form: ["The provided date/time is invalid."] },
      };
    }

    const threeHoursFromNow = addHours(new Date(), 3);
    if (isBefore(flightDateTime, threeHoursFromNow)) {
      return {
        success: false,
        message: "Trip must be scheduled at least 3 hours in advance.",
        errors: { _form: ["Please select a flight time at least 3 hours from now."] },
      };
    }

    // --- Save trip ---
    const userTripRequest: Omit<TripRequest, "id" | "createdAt"> = {
      userId: currentUser.id,
      userName: currentUser.name,
      userPhotoUrl: currentUser.photoUrl,
      flightCode,
      flightDate: format(flightDate, "yyyy-MM-dd"),
      flightTime,
      flightDateTime: flightDateTime.toISOString(),
      departingAirport,
      numberOfCarryons,
      numberOfCheckedBags,
      university,
      campusArea,
      status: "pending",
      userPreferences: preferredMatchGender,
      userGender: currentUser.gender,
      noMatchWarningSent: false,
      cancellationAlert: false,
    };

    await saveTripRequest(userTripRequest);
    console.log("✅ Trip saved successfully!");

    revalidatePath("/dashboard");
    redirect(`/trip-submitted`);

  } catch (error: any) {
    console.error("🔴 submitTripDetailsAction unexpected error:", error);

    return {
      success: false,
      message: "An unexpected error occurred. Please try again.",
      errors: { _form: ["An internal error prevented the trip from being saved."] },
    };
  }
}

export async function getActiveTripForUser(userId: string): Promise<TripRequest | null> {
    const tripsRef = adminDb.collection('tripRequests');
    
    const q = tripsRef
        .where("userId", "==", userId)
        .limit(1);

    const querySnapshot = await q.get();
    if (querySnapshot.empty) {
        return null;
    }
    
    const latestTrip = querySnapshot.docs[0].data() as TripRequest;

    // A trip is only "active" if it is pending or matched, and not yet completed.
    if (latestTrip.status === 'pending' || latestTrip.status === 'matched') {
         if (isPast(addHours(parseISO(latestTrip.flightDateTime), 4))) {
            // If the trip is more than 4 hours in the past, consider it implicitly completed
            // This is a client-side safeguard. The cron job handles official completion.
            return null;
        }
        return latestTrip;
    }
    
    return null;
}
      



const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const ProfileUpdateSchemaServer = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  university: z.string().min(3, "University name is too short."),
  gender: z.enum(['Male', 'Female', 'Other', 'Prefer not to say']),
  userId: z.string().min(1, "User ID is required."),
  campusArea: z.string().optional(),
  photo: z.instanceof(File)
    .optional()
    .refine((file) => !file || file.size <= MAX_FILE_SIZE, `Max file size is 5MB.`)
    .refine(
      (file) => !file || ACCEPTED_IMAGE_TYPES.includes(file.type),
      "Only .jpg, .png, and .webp formats are supported."
    ),
});

export type ProfileUpdateFormState = {
  message?: string;
  errors?: {
    name?: string[];
    university?: string[];
    gender?: string[];
    campusArea?: string[];
    photo?: string[];
    _form?: string[];
  };
  user?: UserProfile;
};


export async function updateUserProfileAction(
  prevState: ProfileUpdateFormState,
  formData: FormData
): Promise<ProfileUpdateFormState> {
  console.log("Received form data:", Object.fromEntries(formData.entries()));
    const validatedFields = ProfileUpdateSchemaServer.safeParse({
        name: formData.get('name'),
        university: formData.get('university'),
        gender: formData.get('gender'),
        userId: formData.get('userId'),
        campusArea: formData.get('campusArea'),
        photo: formData.get('photo'),
    });

    if (!validatedFields.success) {
        return {
        message: "Validation failed.",
        errors: validatedFields.error.flatten().fieldErrors,
        };
    }

    const { userId, name, university, gender, campusArea, photo } = validatedFields.data;
    
    try {
        const dataToUpdate: Partial<UserProfile> = { name, university, gender };
        if (campusArea) {
            dataToUpdate.campusArea = campusArea;
        }

        if (photo && photo.size > 0) {
            const photoUrl = await uploadProfilePhoto(userId, photo);
            dataToUpdate.photoUrl = photoUrl;
        }

        const updatedUser = await updateUserProfile(userId, dataToUpdate);

        revalidatePath('/profile');
        revalidatePath('/dashboard');
        
        return { message: "Profile updated successfully!", user: updatedUser };
    } catch (error: any) {
        console.error("Profile update error:", error);
        return { message: error.message || "An unexpected error occurred.", errors: { _form: [error.message] } };
    }
}


export async function cancelTripAction(
  tripId: string
): Promise<{ success: boolean; message: string }> {
  const user = await getServerUser();
  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  const tripRef = adminDb.collection("tripRequests").doc(tripId);
  const tripSnap = await tripRef.get();

  if (!tripSnap.exists) {
    return { success: false, message: "Trip not found." };
  }

  const tripData = tripSnap.data();
  if (!tripData) {
    return { success: false, message: "Trip data could not be loaded." };
  }

  if (tripData.userId !== user.uid) {
    return { success: false, message: "You are not authorized to cancel this trip." };
  }

  try {
    if (tripData.status === "matched" && tripData.matchId) {
      const matchRef = adminDb.collection("matches").doc(tripData.matchId);
      const matchSnap = await matchRef.get();

      if (matchSnap.exists) {
        const matchData = matchSnap.data();
        if (matchData) {
          const otherUserId = matchData.participantIds?.find((id: string) => id !== user.uid);
          const otherTripId = matchData.tripRequestIds?.find((id: string) => id !== tripId);

          if (otherTripId) {
            await adminDb.collection("tripRequests").doc(otherTripId).update({
              status: "pending",
              matchId: null,
              cancellationAlert: true,
            });
          }

          await matchRef.update({ status: "cancelled" });
        }
      }
    }

    await tripRef.delete();

    revalidatePath("/dashboard");
    revalidatePath("/planned-trips");

    return { success: true, message: "Your trip has been cancelled." };
  } catch (error) {
    console.error("Error cancelling trip:", error);
    return { success: false, message: "Failed to cancel the trip." };
  }
}

  

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: z.string().min(8, "New password must be at least 8 characters."),
  confirmNewPassword: z.string(),
}).refine(data => data.currentPassword !== data.newPassword, {
  message: "New password must be different from the current one.",
  path: ['newPassword'],
}).refine(data => data.newPassword === data.confirmNewPassword, {
  message: "New passwords don't match",
  path: ["confirmNewPassword"],
});

export type ChangePasswordFormState = {
    message?: string;
    errors?: {
        currentPassword?: string[];
        newPassword?: string[];
        confirmNewPassword?: string[];
        _form?: string[];
    }
}

export async function changePasswordAction(prevState: ChangePasswordFormState, formData: FormData): Promise<ChangePasswordFormState> {
    const validatedFields = ChangePasswordSchema.safeParse(Object.fromEntries(formData.entries()));

    if (!validatedFields.success) {
        return { errors: validatedFields.error.flatten().fieldErrors };
    }

    const { currentPassword, newPassword } = validatedFields.data;

    try {
        await changePassword(currentPassword, newPassword);
        return { message: "Your password has been changed successfully. You will be logged out." };
    } catch (error: any) {
        let errorMessage = "An unexpected error occurred.";
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            errorMessage = "The current password you entered is incorrect.";
        } else {
            errorMessage = "Failed to change password. Please try again."
        }
        return { errors: { _form: [errorMessage] } };
    }
}

export async function deleteAccountAction(): Promise<{ success: boolean; message: string; }> {
    try {
        await deleteCurrentUserAccount();
        return { success: true, message: "Account deleted successfully." };
    } catch (error: any) {
        console.error("Delete account error:", error);
        return { success: false, message: error.message || "An unexpected error occurred while deleting your account." };
    }
}
