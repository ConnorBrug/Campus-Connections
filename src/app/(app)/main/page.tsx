
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getActiveTripForUser } from '@/lib/auth';
import type { UserProfile, TripRequest } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Plane, MessageSquare, User, Building, Mail, Cake, VenetianMask } from 'lucide-react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { useApp } from '@/app/(app)/layout';

export default function MainPage() {
  const router = useRouter();
  const { userProfile: user, refreshUserProfile } = useApp();
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
      } catch (error) {
        console.error("Error fetching data for main page:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user, router]);
  
  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const InfoRow = ({ icon, label, value }: { icon: React.ElementType, label: string, value?: string }) => (
    <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2 w-24 text-muted-foreground">
            {React.createElement(icon, { className: "h-4 w-4" })}
            <span>{label}</span>
        </div>
        <span className="font-medium text-foreground/90">{value || 'N/A'}</span>
    </div>
  );

  if (!user || isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center p-4">
        <div className="flex items-center gap-3 text-lg text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p>Loading your details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <Card className="w-full max-w-3xl mx-auto shadow-xl">
        <CardHeader className="text-center bg-muted/30 p-6 border-b">
          <div className="flex justify-center mb-4">
            <Avatar className="h-24 w-24 border-4 border-primary shadow-lg">
                <AvatarImage src={user.photoUrl || ''} alt={user.name} />
                <AvatarFallback className="text-3xl">{getInitials(user.name)}</AvatarFallback>
            </Avatar>
          </div>
          <CardTitle className="text-3xl md:text-4xl font-headline tracking-tight">
            Welcome, {user.name.split(' ')[0]}!
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-8">
            <Card className="bg-background/80 shadow-inner">
                <CardHeader>
                    <CardTitle className="text-xl font-headline flex items-center gap-2">
                        <Plane className="h-5 w-5 text-primary"/>
                        Your Trip Status
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {activeTrip ? (
                        activeTrip.status === 'matched' ? (
                            <>
                                <p className="text-muted-foreground mb-4">You have a matched trip! Time to coordinate.</p>
                                <Button asChild size="lg">
                                    <Link href={`/chat/${activeTrip.matchId}`}>
                                        <MessageSquare className="mr-2 h-5 w-5"/>
                                        Chat with Your Match
                                    </Link>
                                </Button>
                            </>
                        ) : (
                             <>
                                <p className="text-muted-foreground mb-4">We're searching for a match for your pending trip.</p>
                                <Button asChild variant="outline">
                                    <Link href="/planned-trips">View Trip Details</Link>
                                </Button>
                            </>
                        )
                    ) : (
                         <>
                            <p className="text-muted-foreground">You do not have any trips planned. We look forward to connecting you with someone for your next destination!</p>
                             <Button asChild className="mt-4">
                                <Link href="/dashboard">Plan a Trip</Link>
                            </Button>
                        </>
                    )}
                </CardContent>
            </Card>

            <Separator />
            
            <div>
                 <CardTitle className="text-xl font-headline mb-4">Your Profile Details</CardTitle>
                 <div className="space-y-3">
                    <InfoRow icon={User} label="Full Name" value={user.name} />
                    <InfoRow icon={Mail} label="Email" value={user.email} />
                    <InfoRow icon={Building} label="University" value={user.university} />
                    {user.campusArea && <InfoRow icon={Building} label="Campus Area" value={user.campusArea} />}
                    <InfoRow icon={VenetianMask} label="Gender" value={user.gender} />
                    <InfoRow icon={Cake} label="Birthday" value={format(new Date(user.dateOfBirth), 'PPP')} />
                 </div>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
