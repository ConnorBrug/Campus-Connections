// app/api/session/ping/route.ts
import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { adminAuth } from "@/lib/firebase-admin";
import { isRateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET() {
  // Rate limit by IP. This endpoint hits adminAuth.verifySessionCookie on
  // every call, which talks to Google's token service - without a cap it's
  // an easy way to burn our quota or DoS ourselves. 60/min/IP is well
  // above what a polling client needs.
  const hdrs = await headers();
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (isRateLimited(`session-ping:${ip}`, 60, 60_000)) {
    return NextResponse.json({ ok: false, reason: 'rate_limited' }, { status: 429 });
  }

  const jar = await cookies();
  const cookie = jar.get("__session")?.value;
  if (!cookie) return NextResponse.json({ ok: false, reason: "no_cookie" }, { status: 401 });

  try {
    const decoded = await adminAuth.verifySessionCookie(cookie, true);
    return NextResponse.json({ ok: true, uid: decoded.uid, email: decoded.email ?? null });
  } catch (e) {
    // Don't echo the raw error message back - Firebase occasionally returns
    // messages with internal detail. The reason code is enough for the client.
    const reason =
      e instanceof Error && /expired|revoked/i.test(e.message)
        ? "expired"
        : "verify_failed";
    return NextResponse.json({ ok: false, reason }, { status: 401 });
  }
}
