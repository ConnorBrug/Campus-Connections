// lib/server-auth.ts
"use server";

import { cookies } from "next/headers";
import { adminAuth } from "./firebase-admin";

export async function getServerUser() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("__session")?.value;
    if (!sessionCookie) return null;
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    return decoded; // { uid, email, ... }
  } catch (err) {
    console.error("Error verifying server user:", err);
    return null;
  }
}
