
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { User, LogOut, ClipboardList, Loader2, CarFront, Home, TestTube2 } from 'lucide-react';
import { logoutAndRedirectClientSide, getCurrentUser } from '@/lib/auth';
import { useEffect, useState } from 'react';
import type { UserProfile } from '@/lib/types';
import { usePathname } from 'next/navigation';

export function Header() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    const fetchUser = async () => {
      setIsLoading(true);
      const profile = await getCurrentUser();
      setUserProfile(profile);
      setIsLoading(false);
    };
    fetchUser();
  }, [pathname]);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await logoutAndRedirectClientSide();
    } catch (error) {
      console.error("Logout failed:", error);
      setIsLoading(false);
    }
  };

  const Logo = () => (
    <Link href="/dashboard" className="flex items-center gap-2 text-2xl font-bold text-primary-foreground">
      <CarFront className="h-8 w-8 text-primary-foreground" />
      <span className="font-headline">Connections</span>
    </Link>
  );

  if (isLoading) {
    return (
      <header className="sticky top-0 z-50 w-full border-b bg-primary shadow-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <Logo />
          <div className="flex items-center gap-2 sm:gap-4">
             <Loader2 className="h-6 w-6 animate-spin text-primary-foreground/70" />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-primary shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <Logo />
        <nav className="flex items-center gap-1 sm:gap-2">
          {userProfile ? (
            <>
              <Button variant="ghost" size="sm" asChild className="text-primary-foreground hover:bg-primary/80 hover:text-white transition-colors">
                <Link href="/main">
                  <Home className="mr-1 h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Home</span>
                   <span className="sm:hidden">Home</span>
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild className="text-primary-foreground hover:bg-primary/80 hover:text-white transition-colors">
                <Link href="/profile">
                  <User className="mr-1 h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Profile</span>
                   <span className="sm:hidden">Profile</span>
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild className="text-primary-foreground hover:bg-primary/80 hover:text-white transition-colors">
                <Link href="/planned-trips">
                  <ClipboardList className="mr-1 h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Planned Trips</span>
                   <span className="sm:hidden">Trips</span>
                </Link>
              </Button>
               <Button variant="ghost" size="sm" asChild className="text-primary-foreground hover:bg-primary/80 hover:text-white transition-colors">
                <Link href="/test-match">
                  <TestTube2 className="mr-1 h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Test Match</span>
                   <span className="sm:hidden">Test</span>
                </Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-primary-foreground hover:bg-primary/80 hover:text-white transition-colors">
                <LogOut className="mr-1 h-4 w-4 sm:mr-2" />
                 <span className="hidden sm:inline">Logout</span>
                 <span className="sm:hidden">Exit</span>
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild className="text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground">
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
