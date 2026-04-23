// src/lib/csrf.ts
//
// Lightweight same-origin check for state-changing routes.
//
// Cookies are set with SameSite=Lax, which is the primary CSRF defense;
// this helper is a belt-and-suspenders check. It compares the request's
// Origin (or Referer as a fallback) against the configured public origin
// plus a small allowlist of dev hosts, and refuses the request if they
// don't match.
//
// Usage inside a route handler:
//
//     import { assertSameOrigin } from '@/lib/csrf';
//     export async function POST(req: Request) {
//       const fail = assertSameOrigin(req);
//       if (fail) return fail;
//       ...
//     }

import { NextResponse } from 'next/server';

function getAllowedOrigins(): Set<string> {
  const allowed = new Set<string>();
  const base = process.env.NEXT_PUBLIC_BASE_URL;
  if (base) {
    try { allowed.add(new URL(base).origin); } catch {}
  }
  allowed.add('https://campus-connections.com');
  allowed.add('https://www.campus-connections.com');
  if (process.env.NODE_ENV !== 'production') {
    allowed.add('http://localhost:3000');
    allowed.add('http://localhost:3001');
    allowed.add('http://127.0.0.1:3000');
  }
  return allowed;
}

/** Returns a NextResponse to short-circuit the handler, or null if OK. */
export function assertSameOrigin(req: Request): NextResponse | null {
  const allowed = getAllowedOrigins();
  const origin = req.headers.get('origin');
  if (origin) {
    return allowed.has(origin)
      ? null
      : NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
  }
  // Fall back to Referer if no Origin header was sent (some older browsers
  // / same-origin nav requests strip Origin on safe methods, but POST
  // normally carries one).
  const referer = req.headers.get('referer');
  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      return allowed.has(refOrigin)
        ? null
        : NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
    } catch {
      return NextResponse.json({ error: 'Malformed referer' }, { status: 400 });
    }
  }
  // No Origin and no Referer - a tool like curl or a misconfigured proxy.
  // Reject to be safe; legitimate browser POSTs from our app always send one.
  return NextResponse.json({ error: 'Missing origin' }, { status: 403 });
}
