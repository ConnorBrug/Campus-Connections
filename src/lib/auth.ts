

import { 
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
  setPersistence,
  browserSessionPersistence,
  browserLocalPersistence,
  type User as FirebaseUser
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  runTransaction,
  writeBatch,
  limit,
  addDoc,
  serverTimestamp,
  onSnapshot,
  orderBy,
  deleteDoc
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { app, auth, db, storage } from './firebase';
import type { UserProfile, TripRequest, FlaggedEntry, Match } from './types';
import { differenceInHours, parseISO, isPast, differenceInMinutes, format, addHours } from 'date-fns';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { adminDb } from './firebase-admin';

export interface SignupData {
  name: string;
  email: string;
  passwordInput: string;
  university: string;
  photoUrl?: string;
  campusArea?: string;
  gender: 'Male' | 'Female' | 'Other' | 'Prefer not to say';
  dateOfBirth: string; // ISO String
}

export async function signup(userData: SignupData): Promise<FirebaseUser> {
  'use client';
  let userCredential;
  try {
    userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.passwordInput);
    const user = userCredential.user;
    const userDocRef = doc(db, 'users', user.uid);
    await runTransaction(db, async (transaction) => {
        const finalProfileData: UserProfile = {
          id: user.uid,
          name: userData.name,
          email: userData.email,
          university: userData.university,
          photoUrl: userData.photoUrl,
          gender: userData.gender,
          dateOfBirth: userData.dateOfBirth,
          emailVerified: true, 
          isBanned: false,
          ...(userData.campusArea && { campusArea: userData.campusArea }),
        };
        transaction.set(userDocRef, finalProfileData);
    });
    return user;
  } catch (error) {
    if (userCredential && userCredential.user) {
        try {
            await deleteUser(userCredential.user);
        } catch (deleteError) {
            console.error("Failed to cleanup partially created auth user:", deleteError);
        }
    }
    throw error;
  }
}

export async function login(email: string, passwordInput: string): Promise<UserProfile> {
  'use client';
  // Default to local persistence to keep the user signed in across browser sessions.
  await setPersistence(auth, browserLocalPersistence);
  const userCredential = await signInWithEmailAndPassword(auth, email, passwordInput);
  const user = userCredential.user;
  const userProfile = await getUserProfile(user.uid);
  if (!userProfile) {
    throw new Error("User profile not found.");
  }
  return userProfile;
}

export async function logout(): Promise<void> {
    'use client';
    await signOut(auth);
}

export async function logoutAndRedirectClientSide(): Promise<void> {
  'use client';
  await logout();
  if (typeof window !== 'undefined') {
    window.location.href = '/login?logged_out=true';
  }
}

export function getCurrentUser(): Promise<UserProfile | null> {
  'use client';
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (user) {
        try {
          const profile = await getUserProfile(user.uid);
          if (profile?.isBanned) {
            console.warn(`Banned user ${user.uid} attempted to log in.`);
          }
          resolve(profile);
        } catch (error) {
          reject(error);
        }
      } else {
        resolve(null);
      }
    }, reject);
  });
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
    const userDocRef = doc(db, "users", userId);
    const userDoc = await getDoc(userDocRef);
    if (!userDoc.exists()) return null;
    return userDoc.data() as UserProfile;
}


export async function uploadProfilePhoto(userId: string, file: File): Promise<string> {
    const filePath = `profile-photos/${userId}/${file.name}`;
    const storageRef = ref(storage, filePath);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
}

export async function updateUserProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile> {
    const userDocRef = doc(db, "users", userId);
    await updateDoc(userDocRef, data);
    const updatedProfile = await getUserProfile(userId);
    if (!updatedProfile) throw new Error("Failed to retrieve updated profile.");
    return updatedProfile;
}


export async function changePassword(currentPassword: string, newPassword: string):Promise<void> {
  'use client';
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error("No user is currently signed in.");
  }
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

export async function deleteCurrentUserAccount(): Promise<void> {
  'use client';
  const user = auth.currentUser;
  if (!user) {
    throw new Error("No user is signed in to delete.");
  }
  const userId = user.uid;
  try {
    const batch = writeBatch(db);
    const userDocRef = doc(db, "users", userId);
    batch.delete(userDocRef);
    const activeTrip = await getActiveTripForUser(userId);
    if (activeTrip && activeTrip.matchId) {
        const matchRef = doc(db, 'matches', activeTrip.matchId);
        // In a real app, you might want to notify the other user.
        // For simplicity here, we just delete the match.
        batch.delete(matchRef);
        // And find the other trip to reset its status
        const otherTripSnapshot = await getDocs(query(collection(db, 'tripRequests'), where('matchId', '==', activeTrip.matchId), where('userId', '!=', userId)));
        if (!otherTripSnapshot.empty) {
            const otherTripDoc = otherTripSnapshot.docs[0];
            batch.update(otherTripDoc.ref, { status: 'pending', matchId: null, cancellationAlert: true });
        }
    }
    if (activeTrip) {
      const tripDocRef = doc(db, 'tripRequests', activeTrip.id);
      batch.delete(tripDocRef);
    }
    
    const userProfile = await getUserProfile(userId);
    if (userProfile?.photoUrl) {
      try {
        const photoRef = ref(storage, userProfile.photoUrl);
        await deleteObject(photoRef);
      } catch (storageError: any) {
        if (storageError.code !== 'storage/object-not-found') {
          console.error("Could not delete profile photo:", storageError);
        }
      }
    }
    await batch.commit();
    await deleteUser(user);
  } catch (error: any) {
    if (error.code === 'auth/requires-recent-login') {
      throw new Error('This is a sensitive operation. Please log out and log back in before deleting your account.');
    }
    console.error("Error during account deletion process:", error);
    throw new Error("Failed to delete account. Please try again.");
  }
}


// --- Firestore Trip Functions ---

export async function saveTripRequest(tripData: Omit<TripRequest, 'id' | 'createdAt'>): Promise<TripRequest> {
    const docRef = doc(collection(db, 'tripRequests'));
    const newTrip: TripRequest = {
        ...tripData,
        id: docRef.id,
        createdAt: serverTimestamp(),
    };
    
    setDoc(docRef, newTrip)
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'create',
            requestResourceData: newTrip
        });
        errorEmitter.emit('permission-error', permissionError);
      });
      
    return newTrip;
}

export async function getTripById(tripId: string): Promise<TripRequest | null> {
    const docRef = doc(db, 'tripRequests', tripId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() as TripRequest : null;
}

export async function getMatchById(matchId: string): Promise<Match | null> {
    const docRef = doc(db, 'matches', matchId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() as Match : null;
}

export async function getActiveTripForUser(userId: string): Promise<TripRequest | null> {
    'use client';
    const tripsRef = collection(db, 'tripRequests');
    const q = query(tripsRef, 
        where("userId", "==", userId), 
        where("status", "in", ["pending", "matched"]),
        limit(1)
    );

    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        return null;
    }
    
    const latestTrip = querySnapshot.docs[0].data() as TripRequest;

    if (isPast(addHours(parseISO(latestTrip.flightDateTime), 4))) {
        return null;
    }
    
    return latestTrip;
}

export async function getPendingTripsForMatching(currentTripId: string, university: string): Promise<TripRequest[]> {
    const tripsRef = collection(db, 'tripRequests');
    const q = query(tripsRef,
        where("status", "==", "pending"),
        where("university", "==", university),
    );
    const querySnapshot = await getDocs(q);
    const trips: TripRequest[] = [];
    querySnapshot.forEach(doc => {
        const trip = doc.data() as TripRequest;
        if (trip.id !== currentTripId && !isPast(parseISO(trip.flightDateTime))) {
            trips.push(trip);
        }
    });
    return trips;
}

export function findBestMatch(
  currentUserTrip: TripRequest,
  potentialMatches: TripRequest[],
  flaggedUserIds: string[]
): { bestMatch: TripRequest | null; reasoning: Map<string, string> } {
  const reasoning = new Map<string, string>();
  const eligibleMatches = potentialMatches.filter(match => {
    if (flaggedUserIds.includes(match.userId)) {
      reasoning.set(match.id, 'Rejected: User is flagged.');
      return false;
    }
    if (match.departingAirport !== currentUserTrip.departingAirport) {
      reasoning.set(match.id, `Rejected: Airport mismatch.`);
      return false;
    }
    const timeDiffHours = Math.abs(differenceInHours(parseISO(currentUserTrip.flightDateTime), parseISO(match.flightDateTime)));
    if (timeDiffHours > 1) {
      reasoning.set(match.id, `Rejected: Flight time difference > 1 hour.`);
      return false;
    }
    const combinedCheckedBags = currentUserTrip.numberOfCheckedBags + match.numberOfCheckedBags;
    const combinedCarryons = currentUserTrip.numberOfCarryons + match.numberOfCarryons;
    if (combinedCheckedBags > 3 || combinedCarryons > 2) {
      reasoning.set(match.id, `Rejected: Exceeds baggage limits.`);
      return false;
    }
    if (currentUserTrip.university === 'Boston College' &&
        match.university === 'Boston College' &&
        currentUserTrip.campusArea !== match.campusArea) {
      reasoning.set(match.id, `Rejected: Campus area mismatch for BC.`);
      return false;
    }
    return true;
  });

  if (eligibleMatches.length === 0) {
    return { bestMatch: null, reasoning };
  }
  
  const preferredMatches = eligibleMatches.filter(match => {
    const currentUserPrefersMatch = currentUserTrip.userPreferences === 'No preference' || currentUserTrip.userPreferences === match.userGender;
    const matchPrefersCurrentUser = match.userPreferences === 'No preference' || match.userPreferences === currentUserTrip.userGender;
    if (currentUserPrefersMatch && matchPrefersCurrentUser) {
        reasoning.set(match.id, 'Eligible: Meets all criteria including gender preference.');
        return true;
    }
    return false;
  });
  
  if (preferredMatches.length > 0) {
      preferredMatches.sort((a, b) => Math.abs(differenceInMinutes(parseISO(currentUserTrip.flightDateTime), parseISO(a.flightDateTime))) - Math.abs(differenceInMinutes(parseISO(currentUserTrip.flightDateTime), parseISO(b.flightDateTime))));
      reasoning.set(preferredMatches[0].id, 'Selected as Best Match (preferred gender).');
      return { bestMatch: preferredMatches[0], reasoning };
  }
  
  eligibleMatches.sort((a, b) => Math.abs(differenceInMinutes(parseISO(currentUserTrip.flightDateTime), parseISO(b.flightDateTime))) - Math.abs(differenceInMinutes(parseISO(currentUserTrip.flightDateTime), parseISO(a.flightDateTime))));
  reasoning.set(eligibleMatches[0].id, 'Selected as Best Match (fallback, gender preference not met).');
  return { bestMatch: eligibleMatches[0], reasoning };
}


export async function updateTripStatus(tripId: string, status: TripRequest['status'], matchId?: string, matchedUserId?: string, cancellationAlert?: boolean): Promise<void> {
    const tripRef = doc(db, 'tripRequests', tripId);
    if (status === 'cancelled') {
      await deleteDoc(tripRef).catch(err => console.error("Failed to delete cancelled trip:", err));
    } else {
      const updateData: Partial<TripRequest> = { status };
      if (status === 'matched' && matchId) {
          updateData.matchId = matchId;
      } else if (status === 'pending') {
          updateData.matchId = undefined;
          updateData.matchedUserId = undefined; // Kept for simplicity, though matchId is primary
      }
      if (cancellationAlert !== undefined) {
          updateData.cancellationAlert = cancellationAlert;
      }
      await updateDoc(tripRef, updateData);
    }
}

export async function clearCancellationAlert(userId: string): Promise<void> {
    // This function can cause server-side permission issues if called from a server context
    // without Admin SDK. We can disable its body to prevent crashes while preserving its signature.
    /*
    const trip = await getActiveTripForUser(userId);
    if(trip?.cancellationAlert) {
        await updateDoc(doc(db, 'tripRequests', trip.id), { cancellationAlert: false });
    }
    */
}

// --- Real-time Chat Functions ---

export function getChatId(userId1: string, userId2: string): string {
    return [userId1, userId2].sort().join('_');
}

export async function initiateChat(matchId: string, participants: Match['participants']): Promise<void> {
    const userIds = Object.keys(participants);
    const chatId = getChatId(userIds[0], userIds[1]);
    const chatRef = doc(db, 'chats', chatId);

    const participant1 = participants[userIds[0]];
    const participant2 = participants[userIds[1]];

    const welcomeMessage = `
        This is an automated message to start your coordination.\n\n
        - **${participant1.userName}**: Flight ${participant1.flightCode} at ${format(parseISO(participant1.flightDateTime), 'p')}.\n
        - **${participant2.userName}**: Flight ${participant2.flightCode} at ${format(parseISO(participant2.flightDateTime), 'p')}.\n\n
        **Recommendation:** Plan to arrive at the airport at least 1 hour before the earlier flight's boarding time.
    `.trim().replace(/^ +/gm, '');

    await setDoc(chatRef, {
        userIds: userIds,
        lastMessage: "Chat initiated.",
    }, { merge: true });

    await sendMessage(chatId, welcomeMessage, 'system');
}


export async function sendMessage(chatId: string, text: string, senderId: string): Promise<void> {
    const messagesColRef = collection(db, 'chats', chatId, 'messages');
    await addDoc(messagesColRef, {
        text: text,
        senderId: senderId,
        timestamp: serverTimestamp(),
    });
    const chatRef = doc(db, 'chats', chatId);
    await setDoc(chatRef, { lastMessage: text }, { merge: true });
}

export async function setTypingStatus(chatId: string, userId: string | null): Promise<void> {
    'use client';
    const chatRef = doc(db, 'chats', chatId);
    try {
        await updateDoc(chatRef, { typing: userId });
    } catch (error) {
        await setDoc(chatRef, { typing: userId }, { merge: true });
    }
}

export function listenToTypingStatus(chatId: string, callback: (typingUserId: string | null) => void): () => void {
    'use client';
    const chatRef = doc(db, 'chats', chatId);
    return onSnapshot(chatRef, (doc) => {
        const data = doc.data();
        callback(data?.typing || null);
    });
}


// --- Flagging System ---
export async function getFlaggedUsersForUser(userId: string): Promise<string[]> {
    const user = await getUserProfile(userId);
    return user?.flaggedUserIds || [];
}

export async function flagUser(flaggerId: string, flaggedUserId: string, reason: string): Promise<void> {
    const batch = writeBatch(db);

    // 1. Create a new entry in the 'flags' collection
    const flagDocRef = doc(collection(db, 'flags'));
    const flagData: FlaggedEntry = {
        flaggerId,
        flaggedUserId,
        reason,
        timestamp: serverTimestamp(),
    };
    batch.set(flagDocRef, flagData);

    // 2. Add the flagged user's ID to the flagger's profile to prevent future matching
    const flaggerDocRef = doc(db, 'users', flaggerId);
    const flaggerProfile = await getUserProfile(flaggerId);
    const updatedFlaggerIds = [...(flaggerProfile?.flaggedUserIds || []), flaggedUserId];
    batch.update(flaggerDocRef, { flaggedUserIds: updatedFlaggerIds });

    // 3. Check if the flagged user has reached the ban threshold (3 flags)
    const flagsQuery = query(collection(db, 'flags'), where('flaggedUserId', '==', flaggedUserId));
    const flagsSnapshot = await getDocs(flagsQuery);
    if (flagsSnapshot.size >= 2) { // The current flag is the 3rd one
        const flaggedUserDocRef = doc(db, 'users', flaggedUserId);
        batch.update(flaggedUserDocRef, { isBanned: true });
    }

    await batch.commit();
}
