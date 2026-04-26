'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { getActiveTripForUser } from '@/lib/auth';
import type { TripRequest } from '@/lib/types';
import { useApp } from '@/components/providers/AppClientProvider';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import { Loader2, Plane, MessageSquare, ArrowRight } from 'lucide-react';

export default function MainPage() {
  const router = useRouter();
  const { userProfile: user } = useApp();

  const [activeTrip, setActiveTrip] = useState<TripRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    (async () => {
      setIsLoading(true);
      try { setActiveTrip(await getActiveTripForUser(user.id)); }
      catch { /* show empty state */ }
      finally { setIsLoading(false); }
    })();
  }, [user, router]);

  const initials = (name?: string | null) =>
    name ? name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase() : 'U';

  if (!user || isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const firstName = user.name?.split(' ')?.[0] ?? 'there';

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4 md:p-6 -mt-8">
      <div className="w-full max-w-md space-y-4">
        {/* Welcome header */}
        <Card>
          <CardContent className="pt-6 pb-5 text-center">
            <Avatar className="h-16 w-16 mx-auto border-2 border-primary mb-3">
              <AvatarImage src={user.photoUrl ?? undefined} alt={user.name ?? ''} />
              <AvatarFallback className="text-xl">{initials(user.name)}</AvatarFallback>
            </Avatar>
            <h1 className="text-2xl font-bold font-headline">Hey, {firstName}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {user.university}{user.graduationYear ? ` \u2022 Class of ${user.graduationYear}` : ''}
            </p>
          </CardContent>
        </Card>

        {/* Trip status */}
        <Card>
          <CardContent className="pt-5 pb-5">
            {activeTrip ? (
              activeTrip.status === 'matched' && activeTrip.matchId ? (
                <div className="text-center space-y-3">
                  <div className="inline-flex items-center gap-2 text-sm font-medium text-green-700 bg-green-50 rounded-full px-3 py-1">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    Matched
                  </div>
                  <p className="text-sm text-muted-foreground">You have a match — time to coordinate!</p>
                  <Button asChild className="w-full">
                    <Link href={`/chat/${activeTrip.matchId}`}>
                      <MessageSquare className="mr-2 h-4 w-4" /> Open Chat
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="text-center space-y-3">
                  <div className="inline-flex items-center gap-2 text-sm font-medium text-amber-700 bg-amber-50 rounded-full px-3 py-1">
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    Looking for a match
                  </div>
                  <p className="text-sm text-muted-foreground">We&apos;ll notify you when someone matches.</p>
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href="/planned-trips">View Trip Details</Link>
                  </Button>
                </div>
              )
            ) : (
              <div className="text-center space-y-3">
                <Plane className="h-8 w-8 text-primary mx-auto" />
                <p className="text-sm text-muted-foreground">No trips planned yet.</p>
                <Button asChild className="w-full">
                  <Link href="/dashboard">
                    Post a Trip <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3">
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href="/profile">Edit Profile</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href="/planned-trips">My Trips</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
