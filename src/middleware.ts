// src/middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Only check protected app areas
export const config = {
  matcher: ['/main', '/(app)(.*)'],
};

export function middleware(req: NextRequest) {
  const hasSession = req.cookies.get('__session');
  if (!hasSession) {
    const url = new URL('/login', req.url);
    url.searchParams.set('next', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
