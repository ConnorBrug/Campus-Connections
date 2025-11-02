// src/components/providers/AppClientProvider.tsx
'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import type { UserProfile } from '@/lib/types';
import { getCurrentUser } from '@/lib/auth';

type Ctx = { userProfile: UserProfile | null; refreshUserProfile: () => Promise<void> };
const AppCtx = createContext<Ctx | null>(null);

export const useApp = () => {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used inside AppClientProvider');
  return ctx;
};

export default function AppClientProvider({
  children,
  initialProfile,
}: {
  children: React.ReactNode;
  initialProfile?: UserProfile | null;
}) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(initialProfile ?? null);

  const refreshUserProfile = useCallback(async () => {
    const profile = await getCurrentUser();
    setUserProfile(profile);
  }, []);

  return (
    <AppCtx.Provider value={{ userProfile, refreshUserProfile }}>
      {children}
    </AppCtx.Provider>
  );
}
