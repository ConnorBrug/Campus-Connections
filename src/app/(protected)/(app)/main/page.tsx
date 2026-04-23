'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { getActiveTripForUser } from '@/lib/auth';
import type { TripRequest } from '@/lib/types';
import { useApp } from '@/components/providers/AppClientProvider';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

import { Loader2, Plane, MessageSquare, User, Building, Mail, GraduationCap, VenetianMask } from 'lucide-react';

type InfoRowProps = {
  icon: React.ElementType;
  label: string;
  value?: string | null | undefined;
};

const InfoRow: React.FC<InfoRowProps> = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-4 text-sm">
    <div className="flex items-center gap-2 w-28 text-muted-foreground">
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </div>
    <span className="font-medium text-foreground/90">{value ?? 'N/A'}</span>
  </div>
);

export default function MainPage() {
  const router = useRouter();
  const { userProfile: user } = useApp();

  const [activeTrip, setActiveTrip] = useState<TripRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const trip = await getActiveTripForUser(user.id);
        setActiveTrip(trip);
      } catch {
        // Trip fetch failed — show empty state
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user, router]);

  const getInitials = (name?: string | null) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  // Header in protected layout is in-flow and h-16 (4rem).
  // Use viewport minus header height, then nudge up by 2rem like auth pages.
  if (!user || isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4 -mt-8">
        <div className="flex items-center gap-3 text-lg text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p>Loading your details...</p>
        </div>
      </div>
    );
  }

  const showMatchedCTA = activeTrip?.status === 'matched' && !!activeTrip?.matchId;

  const safeEmail = user.email ?? undefined;
  const safeUniversity = user.university ?? undefined;
  const safeCampusArea = user.campusArea ?? undefined;
  const safeGender = user.gender ?? undefined;
  const safeGraduationYear = user.graduationYear ? `Class of ${user.graduationYear}` : undefined;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4 md:p-6 -mt-8">
      <Card className="w-full max-w-3xl mx-auto shadow-xl">
        <CardHeader className="text-center bg-muted/30 p-6 border-b">
          <div className="flex justify-center mb-4">
            <Avatar className="h-24 w-24 border-4 border-primary shadow-lg">
              <AvatarImage src={user.photoUrl ?? undefined} alt={user.name ?? 'User avatar'} />
              <AvatarFallback className="text-3xl">{getInitials(user.name)}</AvatarFallback>
            </Avatar>
          </div>
          <CardTitle className="text-3xl md:text-4xl font-headline tracking-tight">
            Welcome, {user.name?.split(' ')?.[0] ?? 'there'}!
          </CardTitle>
        </CardHeader>

        <CardContent className="p-6 space-y-8">
          <Card className="bg-background/80 shadow-inner">
            <CardHeader>
              <CardTitle className="text-xl font-headline flex items-center gap-2">
                <Plane className="h-5 w-5 text-primary" />
                Your Trip Status
              </CardTitle>
              <CardDescription>
                {activeTrip
                  ? activeTrip.status === 'matched'
                    ? 'You have a matched trip! Time to coordinate.'
                    : "We're searching for a match for your pending trip."
                  : 'Plan a trip to get started.'}
              </CardDescription>
            </CardHeader>

            <CardContent>
              {activeTrip ? (
                activeTrip.status === 'matched' ? (
                  showMatchedCTA ? (
                    <Button asChild size="lg">
                      <Link href={`/chat/${activeTrip.matchId!}`}>
                        <MessageSquare className="mr-2 h-5 w-5" />
                        Chat with Your Match
                      </Link>
                    </Button>
                  ) : (
                    <p className="text-muted-foreground">
                      Your trip is matched, but a chat link isn’t available yet.
                    </p>
                  )
                ) : (
                  <>
                    <p className="text-muted-foreground mb-4">
                      We&apos;re searching for a match for your pending trip.
                    </p>
                    <Button asChild variant="outline">
                      <Link href="/planned-trips">View Trip Details</Link>
                    </Button>
                  </>
                )
              ) : (
                <div className="flex flex-col items-center text-center py-8 px-4 rounded-lg border border-dashed bg-muted/20">
                  <div className="bg-primary/10 p-4 rounded-full mb-4" aria-hidden="true">
                    <Plane className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1">No trips planned yet</h3>
                  <p className="text-muted-foreground max-w-sm mb-4">
                    Post your next airport trip and we&apos;ll connect you with a verified student headed the same way.
                  </p>
                  <Button asChild size="lg">
                    <Link href="/dashboard">Post a Trip</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Separator />

          <div>
            <CardTitle className="text-xl font-headline mb-4">Your Profile Details</CardTitle>
            <div className="space-y-3">
              <InfoRow icon={User} label="Full Name" value={user.name ?? undefined} />
              <InfoRow icon={Mail} label="Email" value={safeEmail} />
              <InfoRow icon={Building} label="University" value={safeUniversity} />
              {safeCampusArea && <InfoRow icon={Building} label="Campus Area" value={safeCampusArea} />}
              <InfoRow icon={VenetianMask} label="Gender" value={safeGender} />
              <InfoRow icon={GraduationCap} label="Class" value={safeGraduationYear} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
