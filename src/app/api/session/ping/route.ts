// app/api/session/ping/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function GET() {
  const jar = await cookies();
  const cookie = jar.get("__session")?.value;
  if (!cookie) return NextResponse.json({ ok: false, reason: "no_cookie" }, { status: 401 });

  try {
    const decoded = await adminAuth.verifySessionCookie(cookie, true);
    return NextResponse.json({ ok: true, uid: decoded.uid, email: decoded.email ?? null });
  } catch (e) {
    const err = e instanceof Error ? e : new Error('Unknown error');
    return NextResponse.json({ ok: false, reason: "verify_failed", message: err.message }, { status: 401 });
  }
}
