
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { UserCheck, MessageSquare, CalendarDays, Loader2, Frown, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getTripById, getMatchById, getCurrentUser } from '@/lib/auth';
import type { Match } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format, parseISO } from 'date-fns';

export default function MatchFoundPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId as string;

  const [currentUser, setCurrentUser] = useState<{ id: string; name?: string | null } | null>(null);
  const [matchDetails, setMatchDetails] = useState<Match | null>(null);
  const [matchedPartnerDetails, setMatchedPartnerDetails] = useState<Match['participants'][string] | null>(null);
  const [allPartners, setAllPartners] = useState<Match['participants'][string][]>([]);
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
              const partnerIds = match.participantIds.filter(id => id !== user.id);
              const partners = partnerIds.map(pid => match.participants[pid]).filter(Boolean);
              setAllPartners(partners);
              if (partners.length > 0) setMatchedPartnerDetails(partners[0]);
            }
          } else if (trip) {
            // Trip exists but isn't matched, redirect
            router.replace('/dashboard');
          }
        } catch {
          // Failed to load match — show empty state
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
            <CardDescription>Could not find the details for this match. It may have been canceled, or there may have been an error.</CardDescription>
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

  return (
    <div className="container mx-auto py-10 px-4 md:px-6 flex flex-col items-center">
      <Card className="w-full max-w-lg shadow-xl rounded-lg">
        <CardHeader className="text-center pt-8 pb-6 border-b">
          <div className="flex justify-center mb-6">
            <UserCheck className="h-20 w-20 text-green-500" />
          </div>
          <CardTitle className="text-3xl md:text-4xl font-headline tracking-tight">It&apos;s a Match!</CardTitle>
          <CardDescription className="text-lg text-muted-foreground mt-2 px-4">
            You&apos;ve been matched with {allPartners.map(p => p.userName).join(' & ') || matchedPartnerDetails.userName} for your upcoming trip.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 px-6 md:px-8 py-8">
            {(allPartners.length > 0 ? allPartners : [matchedPartnerDetails]).map((partner) => (
            <div key={partner.userId} className="flex flex-col items-center gap-4 text-center">
                 <Avatar className="h-24 w-24 border-2 border-primary">
                    <AvatarImage src={partner.userPhotoUrl || ''} alt={partner.userName} data-ai-hint="person avatar"/>
                    <AvatarFallback className="text-3xl">{getInitials(partner.userName)}</AvatarFallback>
                </Avatar>
                <div>
                    <h3 className="text-2xl font-bold">{partner.userName}</h3>
                    <p className="text-md text-muted-foreground">{partner.university}</p>
                </div>
                 <div className="text-sm text-muted-foreground pt-2 space-y-1">
                    <p className="flex items-center gap-2"><User className="h-4 w-4"/>Flight: {partner.flightCode} at {format(parseISO(partner.flightDateTime), 'p')}</p>
                </div>
            </div>
            ))}

            <div className="text-center space-y-4">
                <p className="text-muted-foreground">
                    Next step: Coordinate your ride! Send a message to confirm your plans, pickup location, and share costs.
                </p>
                <Button asChild size="lg">
                    <Link href={`/chat/${matchDetails.id}`}>
                        <MessageSquare className="mr-2 h-5 w-5"/>
                        Chat with your match{allPartners.length > 1 ? 'es' : ''}
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
