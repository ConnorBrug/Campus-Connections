// lib/types.ts
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  university: string;
  campusArea?: string;
  photoUrl?: string;
  emailVerified: boolean;
  gender: "Male" | "Female" | "Other" | "Prefer not to say";
  dateOfBirth: string; // ISO
  flaggedUserIds?: string[];
  isBanned?: boolean;
}

export interface TripRequest {
  id: string;
  userId: string;
  userName: string;
  userPhotoUrl?: string;
  flightCode: string;
  flightDate: string; // yyyy-MM-dd
  flightTime: string; // HH:mm
  flightDateTime: string; // ISO
  departingAirport: string;
  numberOfCarryons: number;
  numberOfCheckedBags: number;
  university: string;
  campusArea?: string;
  status: "pending" | "matched" | "cancelled" | "completed";
  createdAt: any;
  matchId?: string | null;
  matchedUserId?: string | null; // legacy
  userPreferences: "Male" | "Female" | "No preference";
  userGender: "Male" | "Female" | "Other" | "Prefer not to say";
  noMatchWarningSent: boolean;
  cancellationAlert: boolean;
  userHasBeenFlagged?: boolean;
}

export interface Match {
  id: string;
  participantIds: [string, string];
  tripRequestIds: [string, string];
  createdAt: any;
  status: "active" | "completed" | "cancelled";
  participants: {
    [userId: string]: {
      userName: string;
      userPhotoUrl?: string;
      university: string;
      flightCode: string;
      flightDateTime: string;
      bagCount: number;
    };
  };
}

export interface FlaggedEntry {
  id?: string;
  flaggerId: string;
  flaggedUserId: string;
  reason: string;
  timestamp: any;
}
