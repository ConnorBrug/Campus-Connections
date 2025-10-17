// app/api/session/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { idToken } = await req.json();
    if (!idToken) {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const expiresIn = 5 * 24 * 60 * 60 * 1000; // 5 days
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    cookies().set({
      name: "__session",
      value: sessionCookie,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(expiresIn / 1000),
    });

    return NextResponse.json({
      uid: decoded.uid,
      email: decoded.email ?? null,
      name: (decoded as any).name ?? null,
    });
  } catch (err) {
    console.error("Session creation failed:", err);
    return NextResponse.json(
      { error: "Failed to create server session. Please try again." },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  cookies().set("__session", "", {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
  });
  return NextResponse.json({ ok: true });
}
