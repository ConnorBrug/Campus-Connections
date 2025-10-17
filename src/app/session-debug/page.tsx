
// app/session-debug/page.tsx
"use client";
import { useState } from "react";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";

export default function SessionDebugPage() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [out, setOut] = useState<any>(null);
  const [ping, setPing] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    setOut(null);
    setPing(null);
    try {
      const { user } = await signInWithEmailAndPassword(auth, email.trim(), pw);
      const idToken = await user.getIdToken(true);

      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ idToken }),
      });
      let body: any = null;
      try { body = await res.json(); } catch {}
      setOut({ status: res.status, body });

      const pingRes = await fetch("/api/session/ping", { credentials: "same-origin" });
      const pingBody = await pingRes.json().catch(() => ({}));
      setPing({ status: pingRes.status, body: pingBody });
    } catch (e: any) {
      setOut({ error: e?.message || String(e) });
    } finally {
      setBusy(false);
      try { await signOut(auth); } catch {}
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: "40px auto", padding: 16 }}>
      <h1>Session Debug</h1>
      <p>Use a real user & password. This will sign in, set the session cookie, then verify it.</p>
      <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
        <input placeholder="email" value={email} onChange={e => setEmail(e.target.value)} />
        <input placeholder="password" type="password" value={pw} onChange={e => setPw(e.target.value)} />
        <button onClick={run} disabled={busy}>{busy ? "Working..." : "Run Test"}</button>
      </div>
      <pre style={{ background: "#111", color: "#0f0", padding: 12, marginTop: 16, overflowX: "auto" }}>
        {out ? JSON.stringify(out, null, 2) : "No session response yet"}
      </pre>
      <pre style={{ background: "#111", color: "#0ff", padding: 12, marginTop: 16, overflowX: "auto" }}>
        {ping ? JSON.stringify(ping, null, 2) : "No ping yet"}
      </pre>
    </div>
  );
}
