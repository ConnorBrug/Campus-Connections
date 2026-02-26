'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { Loader2, UserCheck, ArrowLeft, Plane, Backpack, Luggage } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

type ManualCandidate = {
  id: string;
  userId: string;
  userName: string;
  userPhotoUrl: string | null;
  university: string;
  campusArea: string | null;
  departingAirport: string;
  flightCode: string;
  flightDateTime: string;
  numberOfCarryons: number;
  numberOfCheckedBags: number;
  genderPreferenceMet: boolean;
};

type ApiState = {
  available: boolean;
  reason?: string;
  myTripId?: string;
  candidates: ManualCandidate[];
};

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

export default function ManualRidesPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [state, setState] = useState<ApiState | null>(null);
  const [loading, setLoading] = useState(true);
  const [matchingId, setMatchingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/manual-rides', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load manual ride posts.');
        const data = (await res.json()) as ApiState;
        setState(data);
      } catch (e) {
        toast({
          title: 'Error',
          description: e instanceof Error ? e.message : 'Could not load manual ride posts.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [toast]);

  const handleMatch = async (candidateTripId: string) => {
    setMatchingId(candidateTripId);
    try {
      const res = await fetch('/api/manual-rides/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ candidateTripId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Manual match failed.');
      toast({ title: 'Match created', description: 'You have been matched successfully.' });
      router.push(`/match-found/${data.tripId}`);
    } catch (e) {
      toast({
        title: 'Match failed',
        description: e instanceof Error ? e.message : 'Could not create a match.',
        variant: 'destructive',
      });
    } finally {
      setMatchingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="flex items-center gap-3 text-lg text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p>Loading ride posts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8">
      <div className="container mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold font-headline">Manual Ride Posts</h1>
          <Button asChild variant="outline">
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>

        {!state?.available && (
          <Alert>
            <AlertTitle>Not Available Yet</AlertTitle>
            <AlertDescription>
              {state?.reason || 'Manual ride posts are currently unavailable for your trip.'}
            </AlertDescription>
          </Alert>
        )}

        {state?.available && state.candidates.length === 0 && (
          <Alert>
            <AlertTitle>No Posts Available</AlertTitle>
            <AlertDescription>
              No compatible manual posts were found right now. We will keep searching automatically.
            </AlertDescription>
          </Alert>
        )}

        {state?.available &&
          state.candidates.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{c.userName}</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {c.genderPreferenceMet ? 'Gender preference matched' : 'Gender preference relaxed'}
                  </span>
                </CardTitle>
                <CardDescription>
                  {c.university}
                  {c.campusArea ? ` • ${c.campusArea}` : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border">
                    <AvatarImage src={c.userPhotoUrl || ''} alt={c.userName} />
                    <AvatarFallback>{initials(c.userName)}</AvatarFallback>
                  </Avatar>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p className="flex items-center gap-2">
                      <Plane className="h-4 w-4" />
                      {c.flightCode} at {format(parseISO(c.flightDateTime), 'PPP p')} ({c.departingAirport})
                    </p>
                    <p className="flex items-center gap-2">
                      <Backpack className="h-4 w-4" />
                      Carry-ons: {c.numberOfCarryons}
                    </p>
                    <p className="flex items-center gap-2">
                      <Luggage className="h-4 w-4" />
                      Checked bags: {c.numberOfCheckedBags}
                    </p>
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={() => handleMatch(c.id)}
                  disabled={matchingId === c.id}
                >
                  {matchingId === c.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Matching...
                    </>
                  ) : (
                    <>
                      <UserCheck className="mr-2 h-4 w-4" />
                      Match with this rider
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  );
}
