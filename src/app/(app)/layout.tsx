
'use client';

import { Header } from '@/components/core/Header';
import { usePathname, useRouter } from 'next/navigation';
import type { UserProfile } from '@/lib/types';
import { useEffect, useState, createContext, useContext, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';

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
    try {
      const profile = await getCurrentUser();
      if (profile) {
        setUserProfile(profile);
      } else {
        router.push('/login');
      }
    } catch (error) {
      console.error("AppLayout: Error checking auth state:", error);
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    const loadUser = async () => {
        setIsLoading(true);
        await fetchUserProfile();
        setIsLoading(false);
    }
    loadUser();
  }, [fetchUserProfile, pathname]);


  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-2 text-muted-foreground">Loading application...</p>
      </div>
    );
  }

  if (!userProfile) {
     return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-2 text-muted-foreground">Redirecting...</p>
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
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="flex-1">{children}</main>
        </div>
    </AppContext.Provider>
  );
}
