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
      className="flex items-center gap-2 text-2xl font-bold text-primary-foreground"
      aria-label="Campus Connections home"
    >
      <CarFront className="h-8 w-8 text-primary-foreground" aria-hidden="true" />
      <span className="font-headline hidden sm:inline">Campus Connections</span>
      <span className="font-headline sm:hidden">Connections</span>
    </Link>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-primary shadow-sm">
      {/* Full-width row, no centered container */}
      <div className="flex h-16 w-full items-center justify-between px-4 md:px-6">
        <Logo />
        <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-primary-foreground hover:bg-primary/80 hover:text-white transition-colors"
          >
            <Link href="/main">
              <Home className="mr-1 h-4 w-4 sm:mr-2" aria-hidden="true" />
              <span className="hidden sm:inline">Home</span>
              <span className="sm:hidden">Home</span>
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-primary-foreground hover:bg-primary/80 hover:text-white transition-colors"
          >
            <Link href="/profile">
              <User className="mr-1 h-4 w-4 sm:mr-2" aria-hidden="true" />
              <span className="hidden sm:inline">Profile</span>
              <span className="sm:hidden">Profile</span>
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-primary-foreground hover:bg-primary/80 hover:text-white transition-colors"
          >
            <Link href="/planned-trips">
              <ClipboardList className="mr-1 h-4 w-4 sm:mr-2" aria-hidden="true" />
              <span className="hidden sm:inline">Planned Trips</span>
              <span className="sm:hidden">Trips</span>
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-primary-foreground hover:bg-primary/80 hover:text-white transition-colors"
          >
            <LogOut className="mr-1 h-4 w-4 sm:mr-2" aria-hidden="true" />
            <span className="hidden sm:inline">Logout</span>
            <span className="sm:hidden">Exit</span>
          </Button>
        </nav>
      </div>
    </header>
  );
}
