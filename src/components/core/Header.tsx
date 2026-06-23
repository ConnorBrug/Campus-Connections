'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  User,
  LogOut,
  ClipboardList,
  CarFront,
  Home,
} from 'lucide-react';
import { logoutAndRedirectClientSide } from '@/lib/auth';

export function Header() {
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await logoutAndRedirectClientSide(); } catch { setLoggingOut(false); }
  };

  const Logo = () => (
    <Link
      href="/main"
      className="flex items-center gap-2 text-xl font-bold text-primary-foreground"
      aria-label="Campus Connections home"
    >
      <CarFront className="h-6 w-6 shrink-0 text-primary-foreground" aria-hidden="true" />
      <span className="font-headline hidden sm:inline">Campus Connections</span>
      <span className="font-headline sm:hidden">Connections</span>
    </Link>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-primary shadow-sm">
      {/* Full-width row. On mobile the nav is icon-only so logo + all four
          actions fit without clipping; labels appear at sm and up. */}
      <div className="flex h-14 w-full items-center justify-between gap-2 px-3 md:px-6">
        <Logo />
        <nav aria-label="Primary" className="flex items-center gap-0.5 sm:gap-2">
          <Button variant="ghost" size="sm" asChild className="px-2 sm:px-3 text-primary-foreground hover:bg-primary/80 hover:text-white transition-colors">
            <Link href="/main" aria-label="Home">
              <Home className="h-5 w-5 sm:mr-2 sm:h-4 sm:w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Home</span>
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild className="px-2 sm:px-3 text-primary-foreground hover:bg-primary/80 hover:text-white transition-colors">
            <Link href="/profile" aria-label="Profile">
              <User className="h-5 w-5 sm:mr-2 sm:h-4 sm:w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Profile</span>
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild className="px-2 sm:px-3 text-primary-foreground hover:bg-primary/80 hover:text-white transition-colors">
            <Link href="/planned-trips" aria-label="Planned trips">
              <ClipboardList className="h-5 w-5 sm:mr-2 sm:h-4 sm:w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Planned Trips</span>
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            disabled={loggingOut}
            aria-label="Log out"
            className="px-2 sm:px-3 text-primary-foreground hover:bg-primary/80 hover:text-white transition-colors"
          >
            <LogOut className="h-5 w-5 sm:mr-2 sm:h-4 sm:w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </nav>
      </div>
    </header>
  );
}
