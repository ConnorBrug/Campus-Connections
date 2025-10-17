// app/api/session/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, extra?: Record<string, unknown>, status = 500) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function POST(req: Request) {
  const jar = await cookies();

  try {
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return jsonError("Invalid content-type", { expected: "application/json", got: ct }, 400);
    }
    const body = await req.json().catch(() => null);
    const idToken = body?.idToken as string | undefined;
    if (!idToken) {
      return jsonError("Missing idToken", { hint: "Call user.getIdToken(true) and POST {idToken}" }, 400);
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const expiresIn = 5 * 24 * 60 * 60 * 1000;
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    jar.set({
      name: "__session",
      value: sessionCookie,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(expiresIn / 1000),
    });

    return NextResponse.json({ ok: true, uid: decoded.uid, email: decoded.email ?? null });
  } catch (err: any) {
    const code = err?.code || err?.errorInfo?.code;
    const message = err?.message || err?.errorInfo?.message;
    console.error("Session creation failed:", { code, message });
    if (code === "auth/invalid-id-token") return jsonError("Invalid ID token", { hint: "Use user.getIdToken(true)" }, 401);
    if (code === "auth/id-token-expired") return jsonError("ID token expired", { hint: "Use user.getIdToken(true)" }, 401);
    if (code === "auth/argument-error") return jsonError("Admin credentials misconfigured", { hint: "Check FIREBASE_SERVICE_ACCOUNT_JSON / PRIVATE_KEY newlines" }, 500);
    return jsonError("Failed to create server session", { code, message }, 500);
  }
}

export async function DELETE() {
  const jar = await cookies();
  jar.set("__session", "", {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
  });
  return NextResponse.json({ ok: true });
}
