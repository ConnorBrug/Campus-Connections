
'use client';

import { Header } from '@/components/core/Header';
import { usePathname, useRouter } from 'next/navigation';
import type { UserProfile } from '@/lib/types';
import { useEffect, useState, createContext, useContext, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

interface AppContextType {
  userProfile: UserProfile | null;
  refreshUserProfile: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within an AppLayout');
    }
    return context;
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const fetchUserProfile = useCallback(async () => {
    // No need to set loading here, it's handled by the initial state
    try {
      const profile = await getCurrentUser();
      setUserProfile(profile);
    } catch (error) {
      console.error("AppLayout: Error checking auth state:", error);
      setUserProfile(null);
    } finally {
        setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  useEffect(() => {
    // This effect runs AFTER the user profile has been fetched and isLoading is false.
    // This prevents the redirect loop.
    if (!isLoading && !userProfile && pathname !== '/verify-email') {
        const unprotectedPaths = ['/login', '/signup', '/forgot-password', '/privacy-policy', '/terms-of-service'];
        if (!unprotectedPaths.includes(pathname)) {
            router.push('/login');
        }
    }
  }, [isLoading, userProfile, router, pathname]);


  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-2 text-muted-foreground">Loading application...</p>
      </div>
    );
  }

  // If we are done loading and there is no user profile on a protected route, show redirecting message.
  if (!userProfile) {
     return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-2 text-muted-foreground">Redirecting to login...</p>
      </div>
    );
  }
  
  const contextValue = {
      userProfile: userProfile,
      refreshUserProfile: async () => {
          await fetchUserProfile();
      }
  };

  return (
    <AppContext.Provider value={contextValue}>
        <FirebaseErrorListener />
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="flex-1">{children}</main>
        </div>
    </AppContext.Provider>
  );
}
