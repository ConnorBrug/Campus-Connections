
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { UserCheck, MessageSquare, CalendarDays, Loader2, Frown, User, Backpack } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getTripById, getMatchById, getCurrentUser } from '@/lib/auth';
import type { TripRequest, Match } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format, parseISO } from 'date-fns';

export default function MatchFoundPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId as string;

  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [matchDetails, setMatchDetails] = useState<Match | null>(null);
  const [matchedPartnerDetails, setMatchedPartnerDetails] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (tripId) {
      setIsLoading(true);
      const fetchMatchData = async () => {
        try {
          const user = await getCurrentUser();
          if (!user) {
            router.push('/login');
            return;
          }
          setCurrentUser(user);

          const trip = await getTripById(tripId);
          if (trip && trip.status === 'matched' && trip.matchId) {
            const match = await getMatchById(trip.matchId);
            if (match) {
              setMatchDetails(match);
              const partnerId = match.participantIds.find(id => id !== user.id);
              if (partnerId && match.participants[partnerId]) {
                 setMatchedPartnerDetails(match.participants[partnerId]);
              }
            }
          } else if (trip) {
            // Trip exists but isn't matched, redirect
            router.replace('/dashboard');
          }
        } catch (err) {
          console.error("Failed to fetch match details", err);
        } finally {
          setIsLoading(false);
        }
      };
      fetchMatchData();
    } else {
      setIsLoading(false);
    }
  }, [tripId, router]);
  
  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6 flex flex-col items-center">
        <Card className="w-full max-w-lg shadow-xl rounded-lg flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="ml-4 text-lg">Finding your match...</p>
        </Card>
      </div>
    );
  }

  if (!matchDetails || !matchedPartnerDetails) {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6 flex flex-col items-center">
        <Card className="w-full max-w-lg shadow-xl rounded-lg p-8 text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <Frown className="h-12 w-12 text-destructive" />
            </div>
            <CardTitle>Match Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>Could not find the details for this match. It may have been cancelled or there was an error.</CardDescription>
          </CardContent>
          <CardFooter className="flex justify-center">
             <Button asChild variant="outline">
                <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const partnerId = matchDetails.participantIds.find(id => id !== currentUser.id);

  return (
    <div className="container mx-auto py-10 px-4 md:px-6 flex flex-col items-center">
      <Card className="w-full max-w-lg shadow-xl rounded-lg">
        <CardHeader className="text-center pt-8 pb-6 border-b">
          <div className="flex justify-center mb-6">
            <UserCheck className="h-20 w-20 text-green-500" />
          </div>
          <CardTitle className="text-3xl md:text-4xl font-headline tracking-tight">It's a Match!</CardTitle>
          <CardDescription className="text-lg text-muted-foreground mt-2 px-4">
            You've been matched with {matchedPartnerDetails.userName} for your upcoming trip.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 px-6 md:px-8 py-8">
            <div className="flex flex-col items-center gap-4 text-center">
                 <Avatar className="h-24 w-24 border-2 border-primary">
                    <AvatarImage src={matchedPartnerDetails.userPhotoUrl || ''} alt={matchedPartnerDetails.userName} data-ai-hint="person avatar"/>
                    <AvatarFallback className="text-3xl">{getInitials(matchedPartnerDetails.userName)}</AvatarFallback>
                </Avatar>
                <div>
                    <h3 className="text-2xl font-bold">{matchedPartnerDetails.userName}</h3>
                    <p className="text-md text-muted-foreground">{matchedPartnerDetails.university}</p>
                </div>
                 <div className="text-sm text-muted-foreground pt-2 space-y-1">
                    <p className="flex items-center gap-2"><User className="h-4 w-4"/>Flight: {matchedPartnerDetails.flightCode} at {format(parseISO(matchedPartnerDetails.flightDateTime), 'p')}</p>
                    <p className="flex items-center gap-2"><Backpack className="h-4 w-4"/>Bags: {matchedPartnerDetails.bagCount}</p>
                </div>
            </div>
          
            <div className="text-center space-y-4">
                <p className="text-muted-foreground">
                    Next step: Coordinate your ride! Send a message to confirm your plans, pickup location, and share costs.
                </p>
                <Button asChild size="lg">
                    <Link href={`/chat/${partnerId}`}>
                        <MessageSquare className="mr-2 h-5 w-5"/>
                        Chat with {matchedPartnerDetails.userName.split(' ')[0]}
                    </Link>
                </Button>
            </div>
        </CardContent>
        <CardFooter className="flex justify-center bg-muted/50 p-4 border-t">
             <Button asChild size="sm" variant="outline">
                <Link href="/planned-trips">
                    <CalendarDays className="mr-2 h-4 w-4" /> View All Planned Trips
                </Link>
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
