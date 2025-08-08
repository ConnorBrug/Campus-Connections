
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration is now hardcoded to ensure it is always available.
const firebaseConfig: FirebaseOptions = {
  "projectId": "connections-hw9ha",
  "appId": "1:689188733774:web:5dfbbfa493a7d8f2c4141f",
  "storageBucket": "connections-hw9ha.firebasestorage.app",
  "apiKey": "AIzaSyBKUwJiswvgULDhk-jb4kGharvZdl29_EM",
  "authDomain": "connections-hw9ha.firebaseapp.com",
  "messagingSenderId": "689188733774"
};

// Initialize Firebase for client-side
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
