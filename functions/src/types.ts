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

  xlRideSuggested?: boolean;
  fallbackTier?: string;
  flightDelayed?: boolean;
}

export type MatchTier =
  | 'standard'
  | 'group'
  | 'relaxed-campus'
  | 'relaxed-time'
  | 'relaxed-gender'
  | 'xl-suggested';

export interface Match {
  id: string;
  participantIds: string[];
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
  requestIds: string[];
  university: string;
  campusArea: string | null;
  departingAirport: string;
  flightCode?: string;
  assignedAtISO: string;
  status: MatchStatus;
  reason?: string;
  matchTier?: MatchTier;
}

// Total pair capacity (across both riders).
export const BAG_CAPACITY = [
  { checked: 2, carry: 2 },
  { checked: 3, carry: 1 },
] as const;

// Group capacity for 3-4 riders (XL ride).
export const GROUP_BAG_CAPACITY = [
  { checked: 3, carry: 3 },
  { checked: 4, carry: 2 },
] as const;
