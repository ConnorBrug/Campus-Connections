'use client';

import { useEffect, useState, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Plane, Trash2, UserCheck, BellRing, Frown, Home } from 'lucide-react';

import { TripDetailsForm } from '@/components/dashboard/TripDetailsForm';
import { CostEstimator } from '@/components/dashboard/CostEstimator';
import { TripStatusTimeline } from '@/components/dashboard/TripStatusTimeline';

import type { TripRequest } from '@/lib/types';
import { getActiveTripForUser } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { useApp } from '@/app/(app)/layout';

export default function DashboardPage() {
  const router = useRouter();
  const { userProfile: currentUser } = useApp();
  const { toast } = useToast();

  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [activeTrip, setActiveTrip] = useState<TripRequest | null>(null);

  useEffect(() => {
    const run = async () => {
      if (!currentUser) {
        setIsLoadingUser(false);
        return;
      }
      setIsLoadingUser(true);
      try {
        const trip = await getActiveTripForUser(currentUser.id);
        setActiveTrip(trip);
      } catch (e) {
        console.error('Failed loading active trip:', e);
        toast({
          title: 'Error Loading Trip',
          description: 'Could not load your active trip. Please try again later.',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingUser(false);
      }
    };
    run();
  }, [currentUser, toast]);

  const handleCancelTrip = async () => {
    if (!activeTrip) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/trips/${activeTrip.id}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || 'Failed to cancel trip.');
        toast({ title: 'Trip Canceled', description: data.message ?? 'Your trip has been canceled.' });
        setActiveTrip(null);
      } catch (e: any) {
        toast({ title: 'Error', description: e.message ?? 'Could not cancel trip.', variant: 'destructive' });
      }
    });
  };

  if (isLoadingUser) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 flex justify-center items-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Loading dashboard...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 flex flex-col items-center min-h-[calc(100vh-10rem)]">
        <Home className="h-10 w-10 mb-2 text-primary" />
        <p className="text-lg">Redirecting to login…</p>
        <Button asChild className="mt-3">
          <Link href="/login">Go to Login</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <h1 className="text-4xl font-bold mb-8 text-center font-headline">Your Airport Ride Share</h1>

      {activeTrip?.cancellationAlert && (
        <Alert className="mb-6 shadow-md border-orange-500 bg-orange-500/10">
          <BellRing className="h-4 w-4 text-orange-500" />
          <AlertTitle className="font-semibold text-orange-700">Update On Your Match</AlertTitle>
          <AlertDescription>
            Unfortunately, your previous match could not make it. We&apos;re actively looking for a new match.
          </AlertDescription>
        </Alert>
      )}

      {activeTrip?.noMatchWarningSent && (
        <Alert className="mb-6 shadow-md border-yellow-500 bg-yellow-500/10">
          <Frown className="h-4 w-4 text-yellow-500" />
          <AlertTitle className="font-semibold text-yellow-700">No Match Found</AlertTitle>
          <AlertDescription>
            We couldn&apos;t find a match for your upcoming trip. Consider arranging alternative transportation.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <TripDetailsForm
            userId={currentUser.id}
            userUniversity={currentUser.university}
            isTripPending={!!activeTrip}
          />
          <CostEstimator />
        </div>

        <div className="lg:col-span-2">
          {activeTrip && (
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <Plane className="h-6 w-6 text-primary" />
                  Your Trip Status
                </CardTitle>
                <CardDescription>
                  {activeTrip.status === 'pending' && "We're looking for a match. You'll be notified when one is found."}
                  {activeTrip.status === 'matched' && "You're matched! Coordinate with your partner."}
                  {activeTrip.status === 'completed' && 'This trip is complete.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <TripStatusTimeline status={activeTrip.status} />

                {activeTrip.status === 'matched' && activeTrip.matchId && (
                  <Button asChild className="w-full">
                    <Link href={`/chat/${activeTrip.matchId}`}>
                      <UserCheck className="mr-2 h-4 w-4" /> Go to Chat
                    </Link>
                  </Button>
                )}

                <div className="flex items-center justify-between gap-4 rounded-md border bg-muted/50 p-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Change of plans?</p>
                    <p className="text-xs text-muted-foreground">You can cancel your trip request at any time.</p>
                  </div>
                  <Button variant="destructive" size="sm" onClick={handleCancelTrip}>
                    <Trash2 className="mr-2 h-4 w-4" /> Cancel Trip
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
