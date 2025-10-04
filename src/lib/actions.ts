
'use server';

import { z } from 'zod';
import type { UserProfile, TripRequest } from './types';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getUserProfile, saveTripRequest, updateTripStatus, getTripById, updateUserProfile, changePassword, deleteCurrentUserAccount, uploadProfilePhoto, getActiveTripForUser } from './auth';
import { isValid, parseISO, format, isBefore, addHours } from 'date-fns';
import { cookies } from 'next/headers';
import { adminDb } from './firebase-admin';
import { admin } from './firebase-admin';
import { doc, getDoc, updateDoc } from 'firebase/firestore';


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
  data: z.infer<typeof TripDetailsSchema>
): Promise<TripDetailsFormState | void> {
    // Schema is already validated by react-hook-form on the client
    const { userId, flightCode, flightDate, flightHour, flightMinute, flightPeriod, departingAirport, numberOfCarryons, numberOfCheckedBags, university, preferredMatchGender, campusArea } = data;

    const [currentUser, existingTrip] = await Promise.all([
      getUserProfile(userId),
      getActiveTripForUser(userId)
    ]);
    
    if (!currentUser) {
        return {
          success: false,
          message: "You must be logged in to submit a trip.",
          errors: { _form: ["User profile could not be loaded."] }
        };
    }
    
    if (currentUser.isBanned) {
        return {
            success: false,
            message: "Your account is suspended from creating new trips.",
            errors: { _form: ["Account suspended."] }
        }
    }

    if (existingTrip) {
        return {
            success: false,
            message: "You already have a pending trip. Please cancel it before creating a new one.",
            errors: { _form: ["An active trip already exists."] },
        };
    }
    
    const flightTime = combineFlightTimeParts(flightHour, flightMinute, flightPeriod);
    const flightDateTime = parseISO(`${format(flightDate, 'yyyy-MM-dd')}T${flightTime}:00`);

    if (!isValid(flightDateTime)) {
        return { success: false, message: "Invalid date or time.", errors: {_form: ["The provided date/time is invalid."]}};
    }
    
    const threeHoursFromNow = addHours(new Date(), 3);
    if (isBefore(flightDateTime, threeHoursFromNow)) {
        return {
            success: false,
            message: "Trip must be scheduled at least 3 hours in advance.",
            errors: { _form: ["Please select a flight time at least 3 hours from now."] }
        };
    }


    try {
        let userTripRequest: Omit<TripRequest, 'id'> = {
            userId: currentUser.id,
            userName: currentUser.name,
            userPhotoUrl: currentUser.photoUrl,
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
            createdAt: new Date().toISOString(),
            userPreferences: preferredMatchGender,
            userGender: currentUser.gender,
            noMatchWarningSent: false,
            cancellationAlert: false,
        };

        await saveTripRequest(userTripRequest);
        
    } catch (error) {
        console.error("Error in submitTripDetailsAction:", error);
        return {
            success: false,
            message: "An unexpected error occurred. Please try again.",
            errors: { _form: ["An internal error prevented the trip from being saved."] },
        };
    }

    // Redirect to a confirmation page immediately.
    // The matching will be handled by the background cron job.
    revalidatePath('/dashboard');
    redirect(`/trip-submitted`);
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


export async function cancelTripAction(tripId: string): Promise<{ success: boolean; message: string; }> {
    const user = await getCurrentUser();
    if (!user) {
        return { success: false, message: "You must be logged in." };
    }

    const trip = await getTripById(tripId);
    if (!trip) {
        return { success: false, message: "Trip not found." };
    }
    if (trip.userId !== user.id) {
        return { success: false, message: "You are not authorized to cancel this trip." };
    }

    try {
        // If the trip was matched, we need to handle the other user as well.
        if (trip.status === 'matched' && trip.matchId) {
            const matchRef = doc(adminDb, 'matches', trip.matchId);
            const matchDoc = await getDoc(matchRef);

            if (matchDoc.exists()) {
                const matchData = matchDoc.data();
                const otherUserId = matchData.participantIds.find((id: string) => id !== user.id);

                if (otherUserId) {
                    const otherTripId = matchData.tripRequestIds.find((id: string) => id !== tripId);
                    if (otherTripId) {
                         const otherTripRef = doc(adminDb, 'tripRequests', otherTripId);
                         // Set other user's trip back to pending and alert them
                         await updateDoc(otherTripRef, { status: 'pending', matchId: null, cancellationAlert: true });
                    }
                }
                 // Update the match status to cancelled
                await updateDoc(matchRef, { status: 'cancelled' });
            }
        }
        
        // Delete the current user's trip request
        await adminDb.collection('tripRequests').doc(tripId).delete();

        revalidatePath('/dashboard');
        revalidatePath('/planned-trips');
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
