
"use client";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  setPersistence,
  browserLocalPersistence,
  deleteUser,
  sendPasswordResetEmail,
  sendEmailVerification,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs,
  runTransaction, writeBatch, limit, addDoc, serverTimestamp, onSnapshot, deleteDoc
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { auth, db, storage } from "./firebase";
import type { UserProfile, TripRequest, FlaggedEntry, Match } from "./types";
import { differenceInHours, parseISO, isPast, differenceInMinutes, format, addHours } from "date-fns";

// ----- Signup -----
export interface SignupData {
  name: string;
  email: string;
  passwordInput: string;
  university: string;
  photoUrl?: string;
  campusArea?: string;
  gender: "Male" | "Female" | "Other" | "Prefer not to say";
  dateOfBirth: string; // ISO
}

export async function signup(userData: SignupData): Promise<FirebaseUser> {
  await setPersistence(auth, browserLocalPersistence);

  const userCredential = await createUserWithEmailAndPassword(
    auth,
    userData.email,
    userData.passwordInput
  );

  const user = userCredential.user;
  try {
    const userDocRef = doc(db, "users", user.uid);
    await runTransaction(db, async (tx) => {
      const profile: UserProfile = {
        id: user.uid,
        name: userData.name,
        email: userData.email,
        university: userData.university,
        photoUrl: userData.photoUrl,
        gender: userData.gender,
        dateOfBirth: userData.dateOfBirth,
        emailVerified: user.emailVerified, // Use initial state from Firebase
        isBanned: false,
        ...(userData.campusArea && { campusArea: userData.campusArea }),
      };
      tx.set(userDocRef, profile);
    });

    // Send verification email
    await sendEmailVerification(user);

    // Create server session
    const idToken = await user.getIdToken(true);
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ idToken }),
    });

    if (!res.ok) {
      throw new Error("Failed to create server session after signup.");
    }

    return user;
  } catch (e) {
    try { await deleteUser(user); } catch {}
    throw e;
  }
}

// ----- Login / Logout + server cookie -----
export async function login(email: string, passwordInput: string): Promise<{profile: UserProfile, user: FirebaseUser}> {
  await setPersistence(auth, browserLocalPersistence);
  const { user } = await signInWithEmailAndPassword(auth, email.trim(), passwordInput);

  const idToken = await user.getIdToken(true);
  const res = await fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) {
    await signOut(auth);
    let msg = 'Failed to create server session. Please try again.';
    try { const d = await res.json(); if (d?.error) msg = d.error; } catch {}
    throw new Error(msg);
  }

  const profile = await getUserProfile(user.uid);
  if (!profile) {
    await signOut(auth);
    throw new Error('User profile not found after login.');
  }
  return { profile, user };
}

export async function logout(): Promise<void> {
  try { await fetch("/api/session", { method: "DELETE", credentials: "same-origin" }); } catch {}
  await signOut(auth);
}

export async function logoutAndRedirectClientSide(): Promise<void> {
  try { await fetch("/api/session", { method: "DELETE", credentials: "same-origin" }); } catch {}
  try { await signOut(auth); } catch {}
  if (typeof window !== "undefined") {
    window.location.href = "/login?logged_out=true";
  }
}

// ----- Current user -----
export function getCurrentUser(): Promise<UserProfile | null> {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(
      auth,
      async (user) => {
        unsub();
        if (!user) return resolve(null);
        try {
          // It's crucial to reload the user to get the latest emailVerified status
          await user.reload();
          if (!user.emailVerified) {
             if (window.location.pathname !== '/verify-email') {
                window.location.href = '/verify-email';
             }
             // For verify-email page, we still resolve profile to show email
             const profile = await getUserProfile(user.uid);
             resolve(profile);
          } else {
             const profile = await getUserProfile(user.uid);
             resolve(profile);
          }
        } catch (e) {
          reject(e);
        }
      },
      reject
    );
  });
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const userDocRef = doc(db, "users", userId);
  const snap = await getDoc(userDocRef);
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

// ----- Profile + password + email -----
export async function uploadProfilePhoto(userId: string, file: File): Promise<string> {
  const path = `profile-photos/${userId}/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}

export async function updateUserProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile> {
  const userDocRef = doc(db, "users", userId);
  await updateDoc(userDocRef, data);
  const updated = await getUserProfile(userId);
  if (!updated) throw new Error("Failed to retrieve updated profile.");
  return updated;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error("No user is currently signed in.");
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

export async function sendVerificationEmail(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("No user is currently signed in to send verification email.");
  await sendEmailVerification(user);
}

// ----- Trips -----
export async function saveTripRequest(tripData: Omit<TripRequest, "id" | "createdAt">): Promise<TripRequest> {
  const docRef = doc(collection(db, "tripRequests"));
  const newTrip: TripRequest = { ...tripData, id: docRef.id, createdAt: serverTimestamp() as any };
  await setDoc(docRef, newTrip);
  return newTrip;
}

export async function getTripById(tripId: string): Promise<TripRequest | null> {
  const docRef = doc(db, "tripRequests", tripId);
  const snap = await getDoc(docRef);
  return snap.exists() ? (snap.data() as TripRequest) : null;
}

export async function getMatchById(matchId: string): Promise<Match | null> {
  const docRef = doc(db, "matches", matchId);
  const snap = await getDoc(docRef);
  return snap.exists() ? (snap.data() as Match) : null;
}

export async function getActiveTripForUser(userId: string): Promise<TripRequest | null> {
  const tripsRef = collection(db, "tripRequests");
  const q = query(tripsRef, where("userId", "==", userId), where("status", "in", ["pending", "matched"]), limit(1));
  const qs = await getDocs(q);
  if (qs.empty) return null;
  const trip = qs.docs[0].data() as TripRequest;
  if (isPast(addHours(parseISO(trip.flightDateTime), 4))) return null;
  return trip;
}

export async function getPendingTripsForMatching(currentTripId: string, university: string): Promise<TripRequest[]> {
  const tripsRef = collection(db, "tripRequests");
  const q = query(tripsRef, where("status", "==", "pending"), where("university", "==", university));
  const qs = await getDocs(q);
  const trips: TripRequest[] = [];
  qs.forEach((d) => {
    const trip = d.data() as TripRequest;
    if (trip.id !== currentTripId && !isPast(parseISO(trip.flightDateTime))) trips.push(trip);
  });
  return trips;
}

export function findBestMatch(
  currentUserTrip: TripRequest,
  potentialMatches: TripRequest[],
  flaggedUserIds: string[]
): { bestMatch: TripRequest | null; reasoning: Map<string, string> } {
  const reasoning = new Map<string, string>();
  const eligible = potentialMatches.filter((m) => {
    if (flaggedUserIds.includes(m.userId)) { reasoning.set(m.id, "Rejected: User is flagged."); return false; }
    if (m.departingAirport !== currentUserTrip.departingAirport) { reasoning.set(m.id, "Rejected: Airport mismatch."); return false; }
    const h = Math.abs(differenceInHours(parseISO(currentUserTrip.flightDateTime), parseISO(m.flightDateTime)));
    if (h > 1) { reasoning.set(m.id, "Rejected: Flight time difference > 1 hour."); return false; }
    const combinedChecked = currentUserTrip.numberOfCheckedBags + m.numberOfCheckedBags;
    const combinedCarry = currentUserTrip.numberOfCarryons + m.numberOfCarryons;
    if (combinedChecked > 3 || combinedCarry > 2) { reasoning.set(m.id, "Rejected: Exceeds baggage limits."); return false; }
    if (currentUserTrip.university === "Boston College" && m.university === "Boston College" && currentUserTrip.campusArea !== m.campusArea) {
      reasoning.set(m.id, "Rejected: Campus area mismatch for BC.");
      return false;
    }
    return true;
  });

  if (!eligible.length) return { bestMatch: null, reasoning };

  const preferred = eligible.filter((m) => {
    const a = currentUserTrip.userPreferences === "No preference" || currentUserTrip.userPreferences === m.userGender;
    const b = m.userPreferences === "No preference" || m.userPreferences === currentUserTrip.userGender;
    if (a && b) { reasoning.set(m.id, "Eligible: Meets all criteria including gender preference."); return true; }
    return false;
  });

  if (preferred.length > 0) {
    preferred.sort(
      (a, b) =>
        Math.abs(differenceInMinutes(parseISO(currentUserTrip.flightDateTime), parseISO(a.flightDateTime))) -
        Math.abs(differenceInMinutes(parseISO(currentUserTrip.flightDateTime), parseISO(b.flightDateTime)))
    );
    reasoning.set(preferred[0].id, "Selected as Best Match (preferred gender).");
    return { bestMatch: preferred[0], reasoning };
  }

  eligible.sort(
    (a, b) =>
      Math.abs(differenceInMinutes(parseISO(currentUserTrip.flightDateTime), parseISO(a.flightDateTime))) -
      Math.abs(differenceInMinutes(parseISO(currentUserTrip.flightDateTime), parseISO(b.flightDateTime)))
  );
  reasoning.set(eligible[0].id, "Selected as Best Match (fallback, gender preference not met).");
  return { bestMatch: eligible[0], reasoning };
}

export async function updateTripStatus(
  tripId: string,
  status: TripRequest["status"],
  matchId?: string,
  _matchedUserId?: string,
  cancellationAlert?: boolean
): Promise<void> {
  const tripRef = doc(db, "tripRequests", tripId);
  if (status === "cancelled") {
    await deleteDoc(tripRef).catch((err) => console.error("Failed to delete cancelled trip:", err));
    return;
  }
  const updateData: Partial<TripRequest> = { status };
  if (status === "matched" && matchId) updateData.matchId = matchId;
  if (status === "pending") updateData.matchId = undefined;
  if (cancellationAlert !== undefined) updateData.cancellationAlert = cancellationAlert;
  await updateDoc(tripRef, updateData);
}

// ----- Chat -----
export function getChatId(userId1: string, userId2: string): string {
  return [userId1, userId2].sort().join("_");
}

export async function initiateChat(_matchId: string, participants: Match["participants"]): Promise<void> {
  const userIds = Object.keys(participants);
  const chatId = getChatId(userIds[0], userIds[1]);
  const chatRef = doc(db, "chats", chatId);

  const p1 = participants[userIds[0]];
  const p2 = participants[userIds[1]];

  const msg = `
This is an automated message to start your coordination.

- **${p1.userName}**: Flight ${p1.flightCode} at ${format(parseISO(p1.flightDateTime), "p")}.
- **${p2.userName}**: Flight ${p2.flightCode} at ${format(parseISO(p2.flightDateTime), "p")}.

**Recommendation:** Plan to arrive at the airport at least 1 hour before the earlier flight's boarding time.
  `.trim();

  await setDoc(chatRef, { userIds, lastMessage: "Chat initiated." }, { merge: true });
  const msgsRef = collection(db, "chats", chatId, "messages");
  await addDoc(msgsRef, { text: msg, senderId: "system", timestamp: serverTimestamp() });
}

export async function setTypingStatus(chatId: string, userId: string | null): Promise<void> {
  const chatRef = doc(db, "chats", chatId);
  try { await updateDoc(chatRef, { typing: userId }); }
  catch { await setDoc(chatRef, { typing: userId }, { merge: true }); }
}

export function listenToTypingStatus(chatId: string, cb: (typingUserId: string | null) => void): () => void {
  const chatRef = doc(db, "chats", chatId);
  return onSnapshot(chatRef, (snap) => cb((snap.data() as any)?.typing || null));
}

// ----- Flags -----
export async function getFlaggedUsersForUser(userId: string): Promise<string[]> {
  const user = await getUserProfile(userId);
  return user?.flaggedUserIds || [];
}

export async function flagUser(flaggerId: string, flaggedUserId: string, reason: string): Promise<void> {
  const batch = writeBatch(db);

  const flagRef = doc(collection(db, "flags"));
  const flagData: FlaggedEntry = { flaggerId, flaggedUserId, reason, timestamp: serverTimestamp() };
  batch.set(flagRef, flagData);

  const flaggerRef = doc(db, "users", flaggerId);
  const flaggerProfile = await getUserProfile(flaggerId);
  const updated = [...(flaggerProfile?.flaggedUserIds || []), flaggedUserId];
  batch.update(flaggerRef, { flaggedUserIds: updated });

  const flagsQuery = query(collection(db, "flags"), where("flaggedUserId", "==", flaggedUserId));
  const flagsSnapshot = await getDocs(flagsQuery);
  if (flagsSnapshot.size >= 2) {
    const flaggedUserRef = doc(db, "users", flaggedUserId);
    batch.update(flaggedUserRef, { isBanned: true });
  }

  await batch.commit();
}

// --- Account Deletion ---
export async function deleteCurrentUserAccount(): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error("No user is currently signed in.");

    // This operation is sensitive and requires recent authentication.
    // In a real app, you would force the user to re-enter their password here.
    // For this example, we assume recent authentication.

    // 1. Call the server API to delete server-side resources
    const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || "Server-side deletion failed.");
    }

    // 2. Delete the client-side user
    // Note: The /api/account/delete endpoint ALREADY deletes the auth user via Admin SDK.
    // So, we just need to sign out on the client.
    await logout();
}
