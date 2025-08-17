
'use client';

import { TripDetailsForm } from '@/components/dashboard/TripDetailsForm';
import { CostEstimator } from '@/components/dashboard/CostEstimator';
import { TripStatusTimeline } from '@/components/dashboard/TripStatusTimeline';
import { cancelTripAction, getActiveTripForUserAction } from '@/lib/actions';
import { useEffect, useState, startTransition } from 'react';
import type { UserProfile, TripRequest } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, Loader2, Plane, Trash2, UserCheck, Search, BellRing, Frown } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function DashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [activeTrip, setActiveTrip] = useState<TripRequest | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchUserAndTrip = async () => {
      setIsLoadingUser(true);
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.push('/login');
          return;
        }
        setCurrentUser(user);
        
        const result = await getActiveTripForUserAction(user.id);
        if (result.success) {
          setActiveTrip(result.trip);
        } else {
            console.error("Failed to fetch active trip:", result.error);
            toast({
              title: "Error Loading Trip",
              description: "Could not load your active trip details. Please try again later.",
              variant: "destructive",
            });
        }

      } catch (error) {
        console.error("Failed to fetch current user for dashboard:", error);
        setCurrentUser(null);
        router.push('/login');
      } finally {
        setIsLoadingUser(false);
      }
    };
    fetchUserAndTrip();
  }, [router, toast]);
  
  const handleCancelTrip = async () => {
    if (!activeTrip) return;
    
    startTransition(async () => {
      const result = await cancelTripAction(activeTrip.id);
      if (result.success) {
        toast({
          title: "Trip Canceled",
          description: result.message,
        });
        setActiveTrip(null);
      } else {
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive",
        });
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
       <div className="container mx-auto py-8 px-4 md:px-6 flex justify-center items-center min-h-[calc(100vh-10rem)]">
         <p className="text-lg">Redirecting to login...</p>
       </div>
    );
  }


  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <h1 className="text-4xl font-bold mb-8 text-center font-headline text-primary-foreground/90">Your Airport Ride Share</h1>

      {activeTrip?.cancellationAlert && (
        <Alert className="mb-6 shadow-md border-orange-500 bg-orange-500/10">
          <BellRing className="h-4 w-4 text-orange-500" />
          <AlertTitle className="font-semibold text-orange-700">Update On Your Match</AlertTitle>
          <AlertDescription>
              <p>
                Unfortunately, your previous match could not make it. We are actively looking for a new match for you.
              </p>
          </AlertDescription>
        </Alert>
      )}

      {activeTrip?.noMatchWarningSent && (
         <Alert className="mb-6 shadow-md border-yellow-500 bg-yellow-500/10">
          <Frown className="h-4 w-4 text-yellow-500" />
          <AlertTitle className="font-semibold text-yellow-700">No Match Found</AlertTitle>
          <AlertDescription>
              <p>
                We were unable to find a match for your upcoming trip. We recommend arranging alternative transportation.
              </p>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <TripDetailsForm
            userId={currentUser?.id}
            userUniversity={currentUser?.university}
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
                             {activeTrip.status === 'completed' && "This trip is complete."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <TripStatusTimeline status={activeTrip.status} />

                         {activeTrip.status === 'matched' && (
                            <Button asChild className="w-full">
                                <Link href={`/chat/${activeTrip.matchedUserId}`}>
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

    
