'use client';

import { useState, useEffect, startTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Plane, CalendarDays, Clock, Backpack, Luggage, Building, Info, Trash2, Frown, Loader2,
  MessageSquare, UserCheck, ShieldAlert,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { useToast } from '@/hooks/use-toast';
import { format, parse, parseISO, isPast } from 'date-fns';

import { getCurrentUser, getActiveTripForUser, getMatchById, flagUser } from '@/lib/auth';
import type { UserProfile, TripRequest, Match } from '@/lib/types';

/* ---------- small helpers to keep TS happy and avoid invalid dates ---------- */
const fmtIsoTime = (iso?: string) => (iso ? format(parseISO(iso), 'p') : 'TBD');
const fmtYmdDate = (ymd?: string) => (ymd ? format(parse(ymd, 'yyyy-MM-dd', new Date()), 'PPP') : 'TBD');
const initials = (name?: string | null) =>
  (name ? name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase() : 'U');

export default function PlannedTripsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeTrip, setActiveTrip] = useState<TripRequest | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [matchedPartner, setMatchedPartner] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [isFlagging, setIsFlagging] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const fetchTripData = async () => {
    setIsLoading(true);
    try {
      const user = await getCurrentUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setCurrentUser(user);

      const trip = await getActiveTripForUser(user.id);
      setActiveTrip(trip);

      if (trip?.status === 'matched' && trip.matchId) {
        const matchDoc = await getMatchById(trip.matchId);
        setMatch(matchDoc);
        if (matchDoc) {
          const partnerId = matchDoc.participantIds.find((id) => id !== user.id);
          if (partnerId && matchDoc.participants[partnerId]) {
            setMatchedPartner(matchDoc.participants[partnerId]);
          }
        }
      } else if (trip?.status === 'completed' && trip.matchId) {
        const matchDoc = await getMatchById(trip.matchId);
        if (matchDoc?.status === 'completed') {
          setMatch(matchDoc);
          const partnerId = matchDoc.participantIds.find((id) => id !== user.id);
          if (partnerId && matchDoc.participants[partnerId]) {
            setMatchedPartner(matchDoc.participants[partnerId]);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching user data for planned trips:', error);
      toast({ title: 'Error', description: 'Could not load trip data.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTripData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancelTrip = () => {
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
        toast({
          title: 'Trip Canceled',
          description: data.message || 'Your trip details have been removed.',
        });
        setActiveTrip(null);
        setMatch(null);
        setMatchedPartner(null);
      } catch (e: any) {
        toast({
          title: 'Error',
          description: e.message ?? 'Could not cancel trip.',
          variant: 'destructive',
        });
      }
    });
  };

  const handleFlagUser = async () => {
    if (!currentUser || !match || !matchedPartner || !flagReason) return;
    const partnerId = match.participantIds.find((id) => id !== currentUser.id);
    if (!partnerId) return;

    setIsFlagging(true);
    try {
      await flagUser(currentUser.id, partnerId, flagReason);
      toast({
        title: 'User Flagged',
        description: 'Thank you for your feedback. Our team will review this report.',
      });
      setActiveTrip((prev) => (prev ? { ...prev, userHasBeenFlagged: true } as any : null));
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not submit flag. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsFlagging(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4 -mt-8">
        <div className="flex items-center gap-3 text-lg text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p>Loading planned trips...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4 -mt-8">
        <p className="text-lg">Redirecting…</p>
      </div>
    );
  }

  const renderNoTrip = () => (
    <>
      <div className="text-center">
        <CardTitle className="text-2xl font-headline">No Trips Planned</CardTitle>
        <CardDescription className="text-lg mt-2">
          You don&apos;t have any trips planned yet. Let&apos;s find your next match!
        </CardDescription>
        <Button asChild size="lg" className="mt-6">
          <Link href="/dashboard">
            <Plane className="mr-2 h-5 w-5" /> Plan a New Trip
          </Link>
        </Button>
      </div>
    </>
  );

  const renderPendingTrip = (trip: TripRequest) => (
    <>
      <CardTitle className="text-3xl font-headline">Your Pending Trip</CardTitle>
      <CardDescription className="text-center text-lg">
        Here are the details for your trip. We&apos;re actively searching for a match.
      </CardDescription>
      <div className="space-y-2 text-sm text-foreground/80 p-4 border rounded-md bg-muted/30 shadow-inner">
        {trip.flightCode && (
          <p className="flex items-center gap-2">
            <Plane className="h-4 w-4 text-primary" /> <strong>Flight Code:</strong> {trip.flightCode}
          </p>
        )}
        {trip.flightDate && (
          <p className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" /> <strong>Date:</strong> {fmtYmdDate(trip.flightDate)}
          </p>
        )}
        {(trip.flightTime || trip.flightDateTime) && (
          <p className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> <strong>Boarding Time:</strong>{' '}
            {trip.flightDateTime ? fmtIsoTime(trip.flightDateTime) : (trip.flightTime ?? 'TBD')}
          </p>
        )}
        {trip.departingAirport && (
          <p className="flex items-center gap-2">
            <Plane className="h-4 w-4 text-primary" /> <strong>Departing Airport:</strong> {trip.departingAirport}
          </p>
        )}
        {currentUser.university && (
          <p className="flex items-center gap-2">
            <Building className="h-4 w-4 text-primary" /> <strong>University:</strong> {currentUser.university}
          </p>
        )}
        <p className="flex items-center gap-2">
          <Backpack className="h-4 w-4 text-primary" /> <strong>Carry-on Bags:</strong> {trip.numberOfCarryons}
        </p>
        <p className="flex items-center gap-2">
          <Luggage className="h-4 w-4 text-primary" /> <strong>Checked Bags:</strong> {trip.numberOfCheckedBags}
        </p>
      </div>
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Next Steps</AlertTitle>
        <AlertDescription>We will notify you on your dashboard when a match is found.</AlertDescription>
      </Alert>
    </>
  );

  const renderFlaggingCard = () => (
    <Card className="mt-6 bg-secondary/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-destructive" />
          Report an Issue
        </CardTitle>
        <CardDescription>
          If you felt unsafe or uncomfortable, please let us know. Your feedback helps keep the community safe.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label htmlFor="flag-reason">Please provide a reason (required):</Label>
          <Textarea
            id="flag-reason"
            value={flagReason}
            onChange={(e) => setFlagReason(e.target.value)}
            placeholder="Please describe the incident."
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="destructive" onClick={handleFlagUser} disabled={isFlagging || !flagReason}>
          {isFlagging ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldAlert className="mr-2 h-4 w-4" />}
          Submit Report
        </Button>
      </CardFooter>
    </Card>
  );

  const renderMatchedTrip = (trip: TripRequest, curMatch: Match, partner: any) => {
    if (!isClient) return null;
    const tripIsInThePast = curMatch.status === 'completed' || (trip.flightDateTime ? isPast(parseISO(trip.flightDateTime)) : false);
    const partnerId = curMatch.participantIds.find((id) => id !== currentUser!.id);

    return (
      <>
        <CardTitle className="text-3xl font-headline flex items-center gap-3 justify-center">
          {tripIsInThePast ? <UserCheck className="h-8 w-8 text-gray-500" /> : <UserCheck className="h-8 w-8 text-green-500" />}
          {tripIsInThePast ? 'Trip Completed' : "You're Matched!"}
        </CardTitle>
        <CardDescription className="text-center text-lg">
          {tripIsInThePast
            ? `This trip with ${partner?.userName ?? 'your partner'} is now complete.`
            : `You've been matched with ${partner?.userName ?? 'your partner'} for your trip.`}
        </CardDescription>

        <div className="p-4 border rounded-md bg-muted/30 shadow-inner space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <Avatar className="h-20 w-20 border-2 border-primary">
              <AvatarImage src={partner?.userPhotoUrl || ''} alt={partner?.userName ?? 'Partner'} data-ai-hint="person avatar" />
              <AvatarFallback>{initials(partner?.userName)}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-xl font-bold">{partner?.userName ?? 'Partner'}</h3>
              <p className="text-sm text-muted-foreground">{partner?.university ?? ''}</p>
              {!tripIsInThePast && partnerId ? (
                <Button size="sm" asChild className="mt-2">
                  <Link href={`/chat/${curMatch.id}`}>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Chat with {(partner?.userName ?? 'Partner').split(' ')[0]}
                  </Link>
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground mt-2">This trip is complete.</p>
              )}
            </div>
          </div>
          <Separator />
          <div>
            <h4 className="font-semibold text-lg mb-2">Shared Trip Details</h4>
            <div className="space-y-1 text-sm text-foreground/80">
              <p className="flex items-center gap-2">
                <Plane className="h-4 w-4 text-primary" /> <strong>Partner&apos;s Flight:</strong>{' '}
                {(partner?.flightCode ?? '—')} at {fmtIsoTime(partner?.flightDateTime)}
              </p>
              <p className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" /> <strong>Date:</strong>{' '}
                {fmtYmdDate(trip?.flightDate)}
              </p>
            </div>
          </div>
        </div>
      </>
    );
  };

  const tripIsInThePast = activeTrip && isClient && match
    ? match.status === 'completed' || (activeTrip.flightDateTime ? isPast(parseISO(activeTrip.flightDateTime)) : false)
    : false;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4 md:p-6 -mt-8">
      <div className="w-full max-w-2xl">
        <Card className="shadow-xl">
          <CardHeader className="text-center" />
          <CardContent className="space-y-6">
            {!activeTrip
              ? renderNoTrip()
              : activeTrip.status === 'pending'
              ? renderPendingTrip(activeTrip)
              : (activeTrip.status === 'matched' || activeTrip.status === 'completed') && match && matchedPartner
              ? renderMatchedTrip(activeTrip, match, matchedPartner)
              : renderNoTrip()}
          </CardContent>

          {activeTrip && isClient && !tripIsInThePast && (
            <CardFooter className="flex flex-col items-center justify-center gap-4 pt-6 border-t">
              <p className="text-sm text-muted-foreground">Change of plans?</p>
              <Button variant="destructive" onClick={handleCancelTrip} size="sm">
                <Trash2 className="mr-2 h-4 w-4" /> Cancel Trip
              </Button>
            </CardFooter>
          )}
        </Card>

        {tripIsInThePast && match && matchedPartner && !activeTrip?.userHasBeenFlagged && isClient && renderFlaggingCard()}
      </div>
    </div>
  );
}
