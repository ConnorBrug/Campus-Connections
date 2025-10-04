

export interface UserProfile {
  id: string; // Firebase UID
  name: string;
  email: string; // Contact info
  university: string;
  campusArea?: string; // Added for Boston College campus area
  photoUrl?: string;
  emailVerified: boolean; // Sourced from FirebaseUser
  gender: 'Male' | 'Female' | 'Other' | 'Prefer not to say';
  dateOfBirth: string; // ISO String
  flaggedUserIds?: string[]; // IDs of users this user has flagged
  isBanned?: boolean; // If true, user cannot create new trips
}

export interface TripDetails {
  flightDate: string; // yyyy-MM-dd
  flightTime: string; // HH:mm
  numberOfCarryons: number;
  numberOfCheckedBags: number;
  departingAirport: string; // Airport code e.g., SFO (user input)
  university: string;
  flightCode: string;
}

export type StoredTripDetails = {
  flightCode: string;
  flightDate: string; // Stored as "yyyy-MM-dd"
  flightTime: string; // Stored as "HH:mm" (24-hour)
  departingAirport: string;
  numberOfCarryons: number;
  numberOfCheckedBags: number;
};

// Represents a trip request stored in the database
export interface TripRequest {
  id: string; // Document ID
  userId: string;
  userName: string;
  userPhotoUrl?: string;
  flightCode: string;
  flightDate: string; // "yyyy-MM-dd"
  flightTime: string; // "HH:mm"
  flightDateTime: string; // ISO string for sorting
  departingAirport: string;
  numberOfCarryons: number;
  numberOfCheckedBags: number;
  university: string;
  campusArea?: string; // Stored for better matching
  status: 'pending' | 'matched' | 'cancelled' | 'completed';
  createdAt: any; // ISO string or Firestore ServerTimestamp
  matchId?: string; // ID of the /matches document
  matchedUserId?: string; // DEPRECATED in favor of matchId, but kept for migration
  userPreferences: 'Male' | 'Female' | 'No preference';
  userGender: 'Male' | 'Female' | 'Other' | 'Prefer not to say';
  noMatchWarningSent: boolean; // Has the 5-hour warning been sent?
  cancellationAlert: boolean; // Should we show the user a cancellation alert?
  userHasBeenFlagged?: boolean; // Has the user of this trip already been flagged?
}

// Represents a confirmed match between two users, with denormalized data
export interface Match {
    id: string;
    participantIds: [string, string];
    tripRequestIds: [string, string];
    createdAt: any; // Firestore ServerTimestamp
    status: "active" | "completed" | "cancelled";
    participants: {
        [userId: string]: {
            userName: string;
            userPhotoUrl?: string;
            university: string;
            flightCode: string;
            flightDateTime: string;
            bagCount: number;
        }
    };
}


export type TripDetailsFormState = {
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
  inputFlightCode?: string;
  inputFlightDate?: string;
  inputFlightTime?: string;
  inputDepartingAirport?: string;
};

// Represents a flag entry in the database
export interface FlaggedEntry {
  id?: string; // Document ID
  flaggerId: string; // User who is flagging
  flaggedUserId: string; // User being flagged
  reason: string;
  timestamp: any; // Firestore ServerTimestamp
}


export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  timestamp: Date;
}
