// src/lib/types.ts
import type { FieldValue, Timestamp } from 'firebase/firestore';

export type MatchPreference = 'Male' | 'Female' | 'No preference';
export type UserGender = 'Male' | 'Female' | 'Other' | 'Prefer not to say';
export const VALID_GENDERS: readonly UserGender[] = ['Male', 'Female', 'Other', 'Prefer not to say'] as const;
export type TripStatus = 'pending' | 'matched' | 'cancelled' | 'completed';
export type MatchStatus = 'matched' | 'cancelled' | 'completed';

/** Firestore timestamp fields can be a Timestamp (read) or FieldValue (write). */
export type FirestoreTimestamp = Timestamp | FieldValue;

export interface UserProfile {
  id: string;
  name?: string | null;
  email?: string | null;
  photoUrl?: string | null;
  university?: string | null;
  campusArea?: string | null;
  gender?: UserGender | null;
  graduationYear?: number | null;
  emailVerified?: boolean;
  flaggedUserIds?: string[];   // <-- used in auth.ts
  isBanned?: boolean;          // <-- used in auth.ts
}

export function profileIsIncomplete(p: UserProfile | null): boolean {
  if (!p) return true;
  if (!p.graduationYear) return true;
  if (!p.gender || !VALID_GENDERS.includes(p.gender)) return true;
  if (p.university === 'Boston College' && !p.campusArea) return true;
  const tokens = (p.name || '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return true;
  return false;
}

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
  matchId: string | null;
  matchedUserId: string | null;

  noMatchWarningSent?: boolean;
  cancellationAlert?: boolean;
  userHasBeenFlagged?: boolean;

  xlRideSuggested?: boolean;
  fallbackTier?: string;
  flightDelayed?: boolean;

  createdAt?: FirestoreTimestamp;
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

// Align with how flagUser() writes docs in auth.ts
export interface FlaggedEntry {
  flaggerId: string;
  flaggedUserId: string;
  reason: string;
  timestamp: FirestoreTimestamp;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: FirestoreTimestamp;
  senderPhotoUrl?: string | null;
  senderName?: string | null;
}
