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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Plane, CalendarDays, Clock, Backpack, Luggage, Building, Info, Trash2, Loader2,
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
const fmtIsoTime = (iso?: string) => (iso ? format(parseISO(iso), 'p') : 'Not available');
const fmtYmdDate = (ymd?: string) => (ymd ? format(parse(ymd, 'yyyy-MM-dd', new Date()), 'PPP') : 'Not available');
const initials = (name?: string | null) =>
  (name ? name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase() : 'U');

export default function PlannedTripsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeTrip, setActiveTrip] = useState<TripRequest | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [matchedPartner, setMatchedPartner] = useState<Match['participants'][string] | null>(null);
  const [matchedPartners, setMatchedPartners] = useState<Match['participants'][string][]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [isFlagging, setIsFlagging] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);

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
          const partnerIds = matchDoc.participantIds.filter((id) => id !== user.id);
          const partners = partnerIds.map(pid => matchDoc.participants[pid]).filter(Boolean);
          setMatchedPartners(partners);
          if (partners.length > 0) setMatchedPartner(partners[0]);
        }
      } else if (trip?.status === 'completed' && trip.matchId) {
        const matchDoc = await getMatchById(trip.matchId);
        if (matchDoc?.status === 'completed') {
          setMatch(matchDoc);
          const partnerIds = matchDoc.participantIds.filter((id) => id !== user.id);
          const partners = partnerIds.map(pid => matchDoc.participants[pid]).filter(Boolean);
          setMatchedPartners(partners);
          if (partners.length > 0) setMatchedPartner(partners[0]);
        }
      }
    } catch {
      toast({ title: 'Error', description: 'Could not load trip data.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTripData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancelTrip = (reason?: string) => {
    if (!activeTrip) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/trips/${activeTrip.id}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ reason: reason || undefined }),
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
        setCancelReason('');
        setShowCancelDialog(false);
      } catch (e) {
        toast({
          title: 'Error',
          description: e instanceof Error ? e.message : 'Could not cancel trip.',
          variant: 'destructive',
        });
      }
    });
  };

  const handleFlightDelay = (action: 'stay' | 'repool') => {
    if (!activeTrip) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/trips/${activeTrip.id}/delay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ action }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || 'Failed to report delay.');
        toast({ title: 'Flight Delay Reported', description: data.message });
        if (action === 'repool') {
          setActiveTrip(null);
          setMatch(null);
          setMatchedPartner(null);
          setMatchedPartners([]);
        }
      } catch (e) {
        toast({
          title: 'Error',
          description: e instanceof Error ? e.message : 'Could not report delay.',
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
      setActiveTrip((prev) => (prev ? { ...prev, userHasBeenFlagged: true } : null));
      setFlagReason('');
    } catch {
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
    <div className="flex flex-col items-center text-center py-8 px-4">
      <div className="bg-primary/10 p-4 rounded-full mb-4" aria-hidden="true">
        <Plane className="h-10 w-10 text-primary" />
      </div>
      <CardTitle className="text-2xl font-headline">No trips planned</CardTitle>
      <CardDescription className="text-base mt-2 max-w-md">
        Post your next airport trip and we&apos;ll match you with a verified student headed the same way.
      </CardDescription>
      <Button asChild size="lg" className="mt-6">
        <Link href="/dashboard">
          <Plane className="mr-2 h-5 w-5" aria-hidden="true" /> Plan a New Trip
        </Link>
      </Button>
    </div>
  );

  const renderPendingTrip = (trip: TripRequest) => (
    <>
      <CardTitle className="text-2xl font-headline">Pending Trip</CardTitle>
      <div className="inline-flex items-center gap-2 text-sm font-medium text-amber-700 bg-amber-50 rounded-full px-3 py-1 mx-auto">
        <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
        Looking for a match
      </div>
      <div className="space-y-1.5 text-sm p-4 border rounded-md bg-muted/30">
        {trip.flightCode && (
          <p><strong>Flight:</strong> {trip.flightCode}</p>
        )}
        {trip.flightDate && (
          <p><strong>Date:</strong> {fmtYmdDate(trip.flightDate)}</p>
        )}
        {(trip.flightTime || trip.flightDateTime) && (
          <p><strong>Boarding:</strong>{' '}
            {trip.flightDateTime ? fmtIsoTime(trip.flightDateTime) : (trip.flightTime ?? '—')}
          </p>
        )}
        {trip.departingAirport && (
          <p><strong>Airport:</strong> {trip.departingAirport}</p>
        )}
        <p><strong>Bags:</strong> {trip.numberOfCarryons} carry-on, {trip.numberOfCheckedBags} checked</p>
      </div>
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

  const renderCancelDialog = () => {
    const isMatched = activeTrip?.status === 'matched';

    if (!isMatched) {
      // Pending trip: simple cancel, no reason needed
      return (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="mr-2 h-4 w-4" /> Cancel Trip
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel your trip?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove your trip request from the matching pool.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Trip</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleCancelTrip()}
                className="bg-destructive hover:bg-destructive/90"
              >
                Yes, cancel
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );
    }

    // Matched trip: require a reason
    return (
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm">
            <Trash2 className="mr-2 h-4 w-4" /> Leave Match
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave your match?</AlertDialogTitle>
            <AlertDialogDescription>
              Your partner will be returned to the matching pool. Please tell us why you&apos;re leaving.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="cancel-reason">Reason (required):</Label>
            <Textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g., scheduling conflict, safety concern, etc."
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCancelReason('')}>Keep Match</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleCancelTrip(cancelReason)}
              className="bg-destructive hover:bg-destructive/90"
              disabled={!cancelReason.trim()}
            >
              Leave Match
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  };

  const renderMatchedTrip = (trip: TripRequest, curMatch: Match, partner: Match['participants'][string]) => {
    if (!isClient) return null;
    const tripIsInThePast = curMatch.status === 'completed' || (trip.flightDateTime ? isPast(parseISO(trip.flightDateTime)) : false);
    const partners = matchedPartners.length > 0 ? matchedPartners : [partner];
    const partnerNames = partners.map(p => p?.userName ?? 'Partner').join(', ');

    return (
      <>
        <CardTitle className="text-3xl font-headline flex items-center gap-3 justify-center">
          {tripIsInThePast ? <UserCheck className="h-8 w-8 text-gray-500" /> : <UserCheck className="h-8 w-8 text-green-500" />}
          {tripIsInThePast ? 'Trip Completed' : "You're Matched!"}
        </CardTitle>
        <CardDescription className="text-center text-lg">
          {tripIsInThePast
            ? `This trip with ${partnerNames} is now complete.`
            : `You've been matched with ${partnerNames} for your trip.`}
        </CardDescription>

        <div className="p-4 border rounded-md bg-muted/30 shadow-inner space-y-4">
          {partners.map((p) => (
            <div key={p.userId} className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              <Avatar className="h-20 w-20 border-2 border-primary">
                <AvatarImage src={p?.userPhotoUrl || ''} alt={p?.userName ?? 'Partner'} data-ai-hint="person avatar" />
                <AvatarFallback>{initials(p?.userName)}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-xl font-bold">{p?.userName ?? 'Partner'}</h3>
                <p className="text-sm text-muted-foreground">{p?.university ?? ''}</p>
                {!tripIsInThePast ? (
                  <Button size="sm" asChild className="mt-2">
                    <Link href={`/chat/${curMatch.id}`}>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Chat with {(p?.userName ?? 'Partner').split(' ')[0]}
                    </Link>
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground mt-2">This trip is complete.</p>
                )}
              </div>
            </div>
          ))}
          <Separator />
          <div>
            <h4 className="font-semibold text-lg mb-2">Shared Trip Details</h4>
            <div className="space-y-1 text-sm text-foreground/80">
              {partners.map((p) => (
                <p key={p.userId} className="flex items-center gap-2">
                  <Plane className="h-4 w-4 text-primary" /> <strong>{p?.userName ?? 'Partner'}&apos;s Flight:</strong>{' '}
                  {(p?.flightCode ?? '—')} at {fmtIsoTime(p?.flightDateTime)}
                </p>
              ))}
              <p className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" /> <strong>Date:</strong>{' '}
                {fmtYmdDate(trip?.flightDate)}
              </p>
            </div>
          </div>

          {!tripIsInThePast && (
            <div className="flex flex-wrap gap-2 pt-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Clock className="mr-2 h-4 w-4" /> Report Flight Delay
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Your flight is delayed?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You can stay with your current match or return to the matching pool to find a new match.
                      Note: if you return to the pool, you may not be matched with anyone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Never mind</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleFlightDelay('stay')}>
                      Stay with my match
                    </AlertDialogAction>
                    <AlertDialogAction
                      onClick={() => handleFlightDelay('repool')}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Return to pool
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="mr-2 h-4 w-4" /> Report Flight Cancellation
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Your flight was canceled?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove you from your match and the matching pool entirely. Your partner will be returned to the pool to find a new match.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Never mind</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleCancelTrip('Flight canceled')}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Yes, remove me
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </>
    );
  };

  const tripIsInThePast = activeTrip && isClient && match
    ? match.status === 'completed' || (activeTrip.flightDateTime ? isPast(parseISO(activeTrip.flightDateTime)) : false)
    : false;

  // Show flag option for active matches AND completed trips
  const showFlagOption = isClient && match && matchedPartner && !activeTrip?.userHasBeenFlagged;

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
              {renderCancelDialog()}
            </CardFooter>
          )}
        </Card>

        {showFlagOption && renderFlaggingCard()}
      </div>
    </div>
  );
}
