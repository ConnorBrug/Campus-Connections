'use client';

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  updateProfile as fbUpdateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
  setPersistence,
  browserLocalPersistence,
  deleteUser,
  sendPasswordResetEmail,
  sendEmailVerification,
  signInWithPopup,
  GoogleAuthProvider,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs,
  runTransaction, writeBatch, limit, addDoc, serverTimestamp, onSnapshot, deleteDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from './firebase';
import type { UserProfile, TripRequest, FlaggedEntry, Match } from './types';
import { differenceInHours, parseISO, isPast, differenceInMinutes, format, addHours } from 'date-fns';
import { normalizeName } from './utils';

// Localize Firebase OOB emails
auth.useDeviceLanguage();

const getBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return (process.env.NEXT_PUBLIC_BASE_URL || 'https://campus-connections.com').replace(/\/$/, '');
};
const getVerificationActionUrl = () => `${getBaseUrl()}/verify`;

const emailToUniversity = (email: string): string | null => {
  const e = email.toLowerCase();
  if (e.endsWith('@bc.edu')) return 'Boston College';
  if (e.endsWith('@vanderbilt.edu')) return 'Vanderbilt';
  if (process.env.NODE_ENV === 'development' && e.endsWith('@gmail.com')) {
    return 'CollegeU';
  }
  return null;
};

const omitUndefined = <T extends Record<string, any>>(obj: T) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;

/* --------------------------------- signup ---------------------------------- */

export interface SignupData {
  name: string;
  email: string;
  passwordInput: string;
  university: string;
  photoUrl?: string;
  campusArea?: string;
  gender: 'Male' | 'Female' | 'Other' | 'Prefer not to say';
  graduationYear: number;
}

export async function signup(userData: SignupData): Promise<FirebaseUser> {
  await setPersistence(auth, browserLocalPersistence);

  // ✅ nuke any stale server cookie so SSR can’t think you’re logged in
  try { await fetch('/api/session', { method: 'DELETE', credentials: 'include' }); } catch {}

  const userCredential = await createUserWithEmailAndPassword(
    auth,
    userData.email,
    userData.passwordInput
  );

  const user = userCredential.user;
  const normalizedName = normalizeName(userData.name);

  try {
    const userDocRef = doc(db, 'users', user.uid);
    await runTransaction(db, async (tx) => {
      const profile: UserProfile = {
        id: user.uid,
        name: normalizedName,
        email: userData.email,
        university: userData.university,
        photoUrl: userData.photoUrl,
        gender: userData.gender,
        graduationYear: userData.graduationYear,
        emailVerified: user.emailVerified, // false initially
        isBanned: false,
        ...(userData.campusArea ? { campusArea: userData.campusArea } : {}),
      };
      tx.set(userDocRef, profile);
    });

    // Keep Firebase Auth display name in sync on sign-up
    try {
      await fbUpdateProfile(user, {
        displayName: normalizedName,
        photoURL: userData.photoUrl ?? null,
      });
    } catch {}

    // ✅ send the verification email
    await sendEmailVerification(user, {
      url: getVerificationActionUrl(),
      handleCodeInApp: true,
    });

    // ❌ DO NOT create an SSR session yet.
    return user;
  } catch (e) {
    try { await deleteUser(user); } catch {}
    throw e;
  }
}

/* -------------------------- login/logout/session --------------------------- */

export async function login(email: string, passwordInput: string): Promise<{ profile: UserProfile; user: FirebaseUser }> {
  await setPersistence(auth, browserLocalPersistence);
  const { user } = await signInWithEmailAndPassword(auth, email.trim(), passwordInput);

  if (user.emailVerified) {
    // ✅ Only verified users get an SSR cookie
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
  } else {
    // make sure no cookie exists
    try { await fetch('/api/session', { method: 'DELETE', credentials: 'include' }); } catch {}
  }

  const profile = await getUserProfile(user.uid);
  if (!profile) {
    await signOut(auth);
    throw new Error('User profile not found after login.');
  }
  return { profile, user };
}

export async function logout(): Promise<void> {
  try { await fetch('/api/session', { method: 'DELETE', credentials: 'same-origin' }); } catch {}
  await signOut(auth);
}

export async function logoutAndRedirectClientSide(): Promise<void> {
  try { await fetch('/api/session', { method: 'DELETE', credentials: 'same-origin' }); } catch {}
  try { await signOut(auth); } catch {}
  if (typeof window !== 'undefined') window.location.href = '/login?logged_out=true';
}

/* ---------------------------- Google sign-in ------------------------------ */

export async function loginWithGoogle(): Promise<{ profile: UserProfile; user: FirebaseUser; isNew: boolean }> {
  await setPersistence(auth, browserLocalPersistence);

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  const result = await signInWithPopup(auth, provider);
  const user = result.user;
  const email = (user.email ?? '').toLowerCase();

  const uni = emailToUniversity(email);

  if (!uni) {
    await signOut(auth);
    throw new Error('Please sign in with a valid university email (e.g., @bc.edu, @vanderbilt.edu) or a Google account for testing in development.');
  }

  const userDocRef = doc(db, 'users', user.uid);
  const existing = await getDoc(userDocRef);

  let isNew = false;
  if (!existing.exists()) {
    isNew = true;

    const rawName = normalizeName(user.displayName ?? email.split('@')[0] ?? '');

    const data = omitUndefined({
      id: user.uid,
      name: rawName,
      email,
      university: uni,
      photoUrl: user.photoURL || undefined,
      emailVerified: true, // Google provider is verified
      isBanned: false,
    });
    await setDoc(userDocRef, data as UserProfile, { merge: true });

    // Also update fb auth profile with normalized name
    if (user.displayName !== rawName) {
      try { await fbUpdateProfile(user, { displayName: rawName }); } catch {}
    }

  } else {
    // If user exists, ensure their name is normalized in our system
    const existingData = existing.data() as UserProfile;
    const normalizedName = normalizeName(existingData.name ?? '');
    if (normalizedName !== existingData.name) {
      await updateDoc(userDocRef, { name: normalizedName });
      if (user.displayName !== normalizedName) {
        try { await fbUpdateProfile(user, { displayName: normalizedName }); } catch {}
      }
    }
  }

  const idToken = await user.getIdToken(true);
  const res = await fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) throw new Error('Failed to create server session after Google sign-in.');

  const profile = (await getDoc(userDocRef)).data() as UserProfile;
  return { profile, user, isNew };
}

/* ----------------------------- current user ----------------------------- */

export function getCurrentUser(): Promise<UserProfile | null> {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(
      auth,
      async (user) => {
        unsub();
        if (!user) return resolve(null);
        try {
          await user.reload();
          const profile = await getUserProfile(user.uid);
          if (!user.emailVerified && typeof window !== 'undefined' && window.location.pathname !== '/verify-email') {
            window.location.href = '/verify-email';
            return resolve(profile);
          }
          resolve(profile);
        } catch (e) {
          reject(e);
        }
      },
      reject
    );
  });
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const userDocRef = doc(db, 'users', userId);
  const snap = await getDoc(userDocRef);
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

/* ----------------------- profile + password + email ---------------------- */

export async function uploadProfilePhoto(userId: string, file: File): Promise<string> {
  const path = `profile-photos/${userId}/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}

export async function updateUserProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile> {
  const userDocRef = doc(db, 'users', userId);
  
  const updatePayload: Partial<UserProfile> = omitUndefined(data);

  if (updatePayload.name) {
    updatePayload.name = normalizeName(updatePayload.name);
  }

  // 1) Update Firestore document
  await updateDoc(userDocRef, updatePayload);

  // 2) Keep Firebase Auth account in sync (displayName / photoURL)
  try {
    if (auth.currentUser) {
      const authUpdatePayload: { displayName?: string | null; photoURL?: string | null } = {};
      if (updatePayload.name) authUpdatePayload.displayName = updatePayload.name;
      if (typeof (data as any).photoUrl === 'string') authUpdatePayload.photoURL = (data as any).photoUrl;
      if (Object.keys(authUpdatePayload).length) {
        await fbUpdateProfile(auth.currentUser, authUpdatePayload);
      }
    }
  } catch (e) {
    console.warn('updateUserProfile: failed to update Firebase Auth profile', e);
  }

  // 3) Refresh ID token so any dependent UI/claims update immediately
  await auth.currentUser?.getIdToken(true);

  // 4) Return re-fetched profile
  const updated = await getUserProfile(userId);
  if (!updated) throw new Error('Failed to retrieve updated profile.');
  return updated;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('No user is currently signed in.');
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

export async function sendVerificationEmailAgain(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('No user is currently signed in to send verification email.');
  await sendEmailVerification(user, {
    url: getVerificationActionUrl(),
    handleCodeInApp: true,
  });
}

/* ------------------------------ trips ---------------------------------- */

export async function saveTripRequest(tripData: Omit<TripRequest, 'id' | 'createdAt'>): Promise<TripRequest> {
  const docRef = doc(collection(db, 'tripRequests'));
  const newTrip: TripRequest = { ...tripData, id: docRef.id, createdAt: serverTimestamp() as any };
  await setDoc(docRef, newTrip);
  return newTrip;
}

export async function getTripById(tripId: string): Promise<TripRequest | null> {
  const docRef = doc(db, 'tripRequests', tripId);
  const snap = await getDoc(docRef);
  return snap.exists() ? (snap.data() as TripRequest) : null;
}

export async function getMatchById(matchId: string): Promise<Match | null> {
  const docRef = doc(db, 'matches', matchId);
  const snap = await getDoc(docRef);
  return snap.exists() ? (snap.data() as Match) : null;
}

export async function getActiveTripForUser(userId: string): Promise<TripRequest | null> {
  const tripsRef = collection(db, 'tripRequests');
  const q = query(tripsRef, where('userId', '==', userId), where('status', 'in', ['pending', 'matched']), limit(1));
  const qs = await getDocs(q);
  if (qs.empty) return null;
  const trip = qs.docs[0].data() as TripRequest;
  if (isPast(addHours(parseISO(trip.flightDateTime), 4))) return null;
  return trip;
}

export function findBestMatch(
  currentUserTrip: TripRequest,
  potentialMatches: TripRequest[],
  flaggedUserIds: string[]
): { bestMatch: TripRequest | null; reasoning: Map<string, string> } {
  const reasoning = new Map<string, string>();
  const eligible = potentialMatches.filter((m) => {
    if (flaggedUserIds.includes(m.userId)) { reasoning.set(m.id, 'Rejected: User is flagged.'); return false; }
    if (m.departingAirport !== currentUserTrip.departingAirport) { reasoning.set(m.id, 'Rejected: Airport mismatch.'); return false; }
    const h = Math.abs(differenceInHours(parseISO(currentUserTrip.flightDateTime), parseISO(m.flightDateTime)));
    if (h > 1) { reasoning.set(m.id, 'Rejected: Flight time difference > 1 hour.'); return false; }
    const combinedChecked = currentUserTrip.numberOfCheckedBags + m.numberOfCheckedBags;
    const combinedCarry = currentUserTrip.numberOfCarryons + m.numberOfCarryons;
    if (combinedChecked > 3 || combinedCarry > 2) { reasoning.set(m.id, 'Rejected: Exceeds baggage limits.'); return false; }
    if (currentUserTrip.university === 'Boston College' && m.university === 'Boston College' && currentUserTrip.campusArea !== m.campusArea) {
      reasoning.set(m.id, 'Rejected: Campus area mismatch for BC.');
      return false;
    }
    return true;
  });

  if (!eligible.length) return { bestMatch: null, reasoning };

  const preferred = eligible.filter((m) => {
    const a = currentUserTrip.userPreferences === 'No preference' || currentUserTrip.userPreferences === m.userGender;
    const b = m.userPreferences === 'No preference' || m.userPreferences === currentUserTrip.userGender;
    if (a && b) { reasoning.set(m.id, 'Eligible: Meets all criteria including gender preference.'); return true; }
    return false;
  });

  if (preferred.length > 0) {
    preferred.sort(
      (a, b) =>
        Math.abs(differenceInMinutes(parseISO(currentUserTrip.flightDateTime), parseISO(a.flightDateTime))) -
        Math.abs(differenceInMinutes(parseISO(currentUserTrip.flightDateTime), parseISO(b.flightDateTime)))
    );
    reasoning.set(preferred[0].id, 'Selected as Best Match (preferred gender).');
    return { bestMatch: preferred[0], reasoning };
  }

  eligible.sort(
    (a, b) =>
      Math.abs(differenceInMinutes(parseISO(currentUserTrip.flightDateTime), parseISO(a.flightDateTime))) -
      Math.abs(differenceInMinutes(parseISO(currentUserTrip.flightDateTime), parseISO(b.flightDateTime)))
  );
  reasoning.set(eligible[0].id, 'Selected as Best Match (fallback, gender preference not met).');
  return { bestMatch: eligible[0], reasoning };
}

export async function updateTripStatus(
  tripId: string,
  status: TripRequest['status'],
  matchId?: string,
  _matchedUserId?: string,
  cancellationAlert?: boolean
): Promise<void> {
  const tripRef = doc(db, 'tripRequests', tripId);
  if (status === 'cancelled') {
    await deleteDoc(tripRef).catch((err) => console.error('Failed to delete cancelled trip:', err));
    return;
  }
  const updateData: Partial<TripRequest> = { status };
  if (status === 'matched' && matchId) updateData.matchId = matchId;
  if (status === 'pending') updateData.matchId = undefined;
  if (cancellationAlert !== undefined) updateData.cancellationAlert = cancellationAlert;
  await updateDoc(tripRef, updateData);
}

/* ------------------------------ chat/flags ------------------------------ */

export function getChatId(userId1: string, userId2: string): string {
  return [userId1, userId2].sort().join('_');
}

export async function sendMessage(chatId: string, senderId: string, text: string): Promise<void> {
  const chatRef = doc(db, 'chats', chatId);
  const msgsRef = collection(chatRef, 'messages');
  await addDoc(msgsRef, { senderId, text, timestamp: serverTimestamp() });
  await updateDoc(chatRef, { lastMessage: text, lastUpdated: serverTimestamp() });
}

export async function initiateChat(_matchId: string, participants: Match['participants']): Promise<void> {
  const userIds = Object.keys(participants);
  const chatId = getChatId(userIds[0], userIds[1]);
  const chatRef = doc(db, 'chats', chatId);

  const p1 = participants[userIds[0]];
  const p2 = participants[userIds[1]];

  const msg = `
This is an automated message to start your coordination.

- **${p1.userName}**: Flight ${p1.flightCode} at ${format(parseISO(p1.flightDateTime), 'p')}.
- **${p2.userName}**: Flight ${p2.flightCode} at ${format(parseISO(p2.flightDateTime), 'p')}.

**Recommendation:** Plan to arrive at the airport at least 1 hour before the earlier flight's boarding time.
  `.trim();

  await setDoc(chatRef, { userIds, lastMessage: 'Chat initiated.' }, { merge: true });
  const msgsRef = collection(chatRef, 'chats', chatId, 'messages');
  await addDoc(msgsRef, { text: msg, senderId: 'system', timestamp: serverTimestamp() });
}

export async function setTypingStatus(chatId: string, userId: string | null): Promise<void> {
  const chatRef = doc(db, 'chats', chatId);
  try { await updateDoc(chatRef, { typing: userId }); }
  catch { await setDoc(chatRef, { typing: userId }, { merge: true }); }
}

export function listenToTypingStatus(chatId: string, cb: (typingUserId: string | null) => void): () => void {
  const chatRef = doc(db, 'chats', chatId);
  return onSnapshot(chatRef, (snap) => cb((snap.data() as any)?.typing || null));
}

export async function getFlaggedUsersForUser(userId: string): Promise<string[]> {
  const user = await getUserProfile(userId);
  return user?.flaggedUserIds || [];
}

export async function flagUser(flaggerId: string, flaggedUserId: string, reason: string): Promise<void> {
  const batch = writeBatch(db);

  const flagRef = doc(collection(db, 'flags'));
  const flagData: FlaggedEntry = { flaggerId, flaggedUserId, reason, timestamp: serverTimestamp() };
  batch.set(flagRef, flagData);

  const flaggerRef = doc(db, 'users', flaggerId);
  const flaggerProfile = await getUserProfile(flaggerId);
  const updated = [...(flaggerProfile?.flaggedUserIds || []), flaggedUserId];
  batch.update(flaggerRef, { flaggedUserIds: updated });

  const flagsQuery = query(collection(db, 'flags'), where('flaggedUserId', '==', flaggedUserId));
  const flagsSnapshot = await getDocs(flagsQuery);
  if (flagsSnapshot.size >= 2) {
    const flaggedUserRef = doc(db, 'users', flaggedUserId);
    batch.update(flaggedUserRef, { isBanned: true });
  }

  await batch.commit();
}

export async function deleteCurrentUserAccount(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('No user is currently signed in.');
  const res = await fetch('/api/account/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Server-side deletion failed.');
  await logout();
}
