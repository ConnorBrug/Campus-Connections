// functions/src/types.ts
export type MatchPreference = 'Male' | 'Female' | 'No preference';
export type UserGender = 'Male' | 'Female' | 'Other' | 'Prefer not to say'; // include "Other"
export type TripStatus = 'pending' | 'matched' | 'cancelled' | 'completed';
export type MatchStatus = 'matched' | 'cancelled' | 'completed';

export interface TripRequest {
  id: string;
  userId: string;
  userName?: string | null;
  userEmail?: string | null;
  userPhotoUrl?: string | null;

  university: string;
  campusArea?: string | null;
  departingAirport: string;
  flightCode: string;
  flightDateTime: string;

  flightDate?: string;
  flightTime?: string;

  numberOfCarryons: number;
  numberOfCheckedBags: number;

  userPreferences: MatchPreference;
  userGender: UserGender;

  status: TripStatus;
  createdAt?: FirebaseFirestore.Timestamp;
  matchId: string | null;
  matchedUserId: string | null;

  noMatchWarningSent?: boolean;
  cancellationAlert?: boolean;
  userHasBeenFlagged?: boolean;
}

export interface Match {
  id: string;
  participantIds: [string, string];
  participants: Record<
    string,
    {
      userId: string;
      userName: string;
      userPhotoUrl?: string | null;
      university: string;
      flightCode: string;
      flightDateTime: string;
    }
  >;
  requestIds: [string, string];
  university: string;
  campusArea: string | null;
  departingAirport: string;
  flightCode?: string;
  assignedAtISO: string;
  status: MatchStatus;
  reason?: string;
}

// Total pair capacity (across both riders).
export const BAG_CAPACITY = [
  { checked: 2, carry: 2 },
  { checked: 3, carry: 1 },
] as const;
