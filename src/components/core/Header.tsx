'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  User,
  LogOut,
  ClipboardList,
  Loader2,
  CarFront,
  Home,
} from 'lucide-react';
import { logoutAndRedirectClientSide, getCurrentUser } from '@/lib/auth';
import type { UserProfile } from '@/lib/types';

export function Header() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setIsLoading(true);
        const profile = await getCurrentUser();
        if (mounted) setUserProfile(profile);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [pathname]);

  const handleLogout = async () => {
    setIsLoading(true);
    try { await logoutAndRedirectClientSide(); } catch { setIsLoading(false); }
  };

  const Logo = () => (
    <Link
      href="/main"
      className="flex items-center gap-2 text-2xl font-bold text-primary-foreground"
    >
      <CarFront className="h-8 w-8 text-primary-foreground" />
      <span className="font-headline">Connections</span>
    </Link>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-primary shadow-sm">
      {/* Full-width row, no centered container */}
      <div className="flex h-16 w-full items-center justify-between px-4 md:px-6">
        <Logo />
        <nav className="flex items-center gap-1 sm:gap-2">
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary-foreground/70" />
          ) : userProfile ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="text-primary-foreground hover:bg-primary/80 hover:text-white transition-colors"
              >
                <Link href="/main">
                  <Home className="mr-1 h-4 w-4 sm:mr-2" />
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
                  <User className="mr-1 h-4 w-4 sm:mr-2" />
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
                  <ClipboardList className="mr-1 h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Planned Trips</span>
                  <span className="sm:hidden">Trips</span>
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-primary-foreground hover:bg-primary/80 hover:text-white transition-colors"
              >
                <LogOut className="mr-1 h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Logout</span>
                <span className="sm:hidden">Exit</span>
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground"
              >
                <Link href="/login">Login</Link>
              </Button>
              <Button variant="secondary" size="sm" asChild>
                <Link href="/signup">Sign Up</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
