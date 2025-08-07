
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getActiveTripForUser, getPendingTripsForMatching, getFlaggedUsersForUser, findBestMatch } from '@/lib/auth';
import type { TripRequest } from '@/lib/types';
import Link from 'next/link';
import { format, parseISO, addMinutes, subMinutes, addHours } from 'date-fns';
import { Loader2, TestTube2, CheckCircle2, XCircle, User, Plane, Calendar, Clock, Beaker } from 'lucide-react';
import { useApp } from '@/app/(app)/layout';
import { Separator } from '@/components/ui/separator';

type TestResult = {
    bestMatch: TripRequest | null;
    candidates: TripRequest[];
    reasoning: Map<string, string>;
}

// Helper to create faux trip data for testing
const createFauxCandidates = (baseTrip: TripRequest): TripRequest[] => {
    const baseDate = parseISO(baseTrip.flightDateTime);
    return [
        {
            id: 'faux-perfect',
            userId: 'faux-user-1',
            userName: 'Perfect Penny',
            flightCode: 'B6123',
            departingAirport: baseTrip.departingAirport,
            flightDateTime: addMinutes(baseDate, 30).toISOString(),
            flightDate: format(addMinutes(baseDate, 30), 'yyyy-MM-dd'),
            flightTime: format(addMinutes(baseDate, 30), 'HH:mm'),
            numberOfCarryons: 1,
            numberOfCheckedBags: 1,
            university: baseTrip.university,
            status: 'pending',
            createdAt: new Date().toISOString(),
            userPreferences: 'No preference',
            userGender: 'Female',
            noMatchWarningSent: false,
            cancellationAlert: false,
        },
        {
            id: 'faux-too-far',
            userId: 'faux-user-2',
            userName: 'Distant Dan',
            flightCode: 'DL456',
            departingAirport: baseTrip.departingAirport,
            flightDateTime: addHours(baseDate, 2).toISOString(),
            flightDate: format(addHours(baseDate, 2), 'yyyy-MM-dd'),
            flightTime: format(addHours(baseDate, 2), 'HH:mm'),
            numberOfCarryons: 1,
            numberOfCheckedBags: 1,
            university: baseTrip.university,
            status: 'pending',
            createdAt: new Date().toISOString(),
            userPreferences: 'No preference',
            userGender: 'Male',
            noMatchWarningSent: false,
            cancellationAlert: false,
        },
        {
            id: 'faux-wrong-airport',
            userId: 'faux-user-3',
            userName: 'Lost Larry',
            flightCode: 'AA789',
            departingAirport: baseTrip.departingAirport === 'BOS' ? 'JFK' : 'BOS',
            flightDateTime: subMinutes(baseDate, 15).toISOString(),
            flightDate: format(subMinutes(baseDate, 15), 'yyyy-MM-dd'),
            flightTime: format(subMinutes(baseDate, 15), 'HH:mm'),
            numberOfCarryons: 0,
            numberOfCheckedBags: 1,
            university: baseTrip.university,
            status: 'pending',
            createdAt: new Date().toISOString(),
            userPreferences: 'No preference',
            userGender: 'Male',
            noMatchWarningSent: false,
            cancellationAlert: false,
        },
        {
            id: 'faux-too-many-bags',
            userId: 'faux-user-4',
            userName: 'Baggage Bob',
            flightCode: 'UA101',
            departingAirport: baseTrip.departingAirport,
            flightDateTime: addMinutes(baseDate, 45).toISOString(),
            flightDate: format(addMinutes(baseDate, 45), 'yyyy-MM-dd'),
            flightTime: format(addMinutes(baseDate, 45), 'HH:mm'),
            numberOfCarryons: 2, // This user: 2, Base user: 1 -> Total: 3 (exceeds limit of 2)
            numberOfCheckedBags: 2,
            university: baseTrip.university,
            status: 'pending',
            createdAt: new Date().toISOString(),
            userPreferences: 'No preference',
            userGender: 'Male',
            noMatchWarningSent: false,
            cancellationAlert: false,
        },
    ];
};


export default function TestMatchPage() {
  const { userProfile } = useApp();
  const [activeTrip, setActiveTrip] = useState<TripRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  useEffect(() => {
    const fetchTrip = async () => {
      if (!userProfile) return;
      setIsLoading(true);
      try {
        const trip = await getActiveTripForUser(userProfile.id);
        setActiveTrip(trip);
      } catch (error) {
        console.error("Error fetching active trip:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTrip();
  }, [userProfile]);

  const handleRunTest = async (useFauxData = false) => {
    if (!activeTrip || !userProfile) return;
    setIsTesting(true);
    setTestResult(null);
    try {
        const candidates = useFauxData
            ? createFauxCandidates(activeTrip)
            : await getPendingTripsForMatching(activeTrip.id, activeTrip.university);
      
        const flaggedUsers = await getFlaggedUsersForUser(userProfile.id);
        const { bestMatch, reasoning } = findBestMatch(activeTrip, candidates, flaggedUsers);
      
        setTestResult({ bestMatch, candidates, reasoning });

    } catch (error) {
      console.error("Error running match test:", error);
    } finally {
      setIsTesting(false);
    }
  };

  const ResultIcon = ({ isMatch }: { isMatch: boolean }) => (
    isMatch 
      ? <CheckCircle2 className="h-5 w-5 text-green-500" />
      : <XCircle className="h-5 w-5 text-destructive" />
  );

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 flex justify-center items-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Loading your trip data...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <Card className="w-full max-w-4xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <TestTube2 className="h-6 w-6 text-primary" />
            Match Feature Test Bench
          </CardTitle>
          <CardDescription>
            Use this page to manually run the matching algorithm against your active trip and see the results.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!activeTrip || activeTrip.status !== 'pending' ? (
            <Alert>
              <AlertTitle>No Pending Trip Found</AlertTitle>
              <AlertDescription>
                You don't have a pending trip to test. Please{' '}
                <Link href="/dashboard" className="underline font-semibold">submit a trip</Link>{' '}
                first. The test bench only works for trips that are actively seeking a match.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Card className="bg-muted/30">
                <CardHeader>
                  <CardTitle className="text-xl">Your Active Trip</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                   <p className="flex items-center gap-2"><Plane className="h-4 w-4" /> <strong>Flight:</strong> {activeTrip.flightCode} from {activeTrip.departingAirport}</p>
                   <p className="flex items-center gap-2"><Calendar className="h-4 w-4" /> <strong>Date:</strong> {format(parseISO(activeTrip.flightDateTime), 'PPP')}</p>
                   <p className="flex items-center gap-2"><Clock className="h-4 w-4" /> <strong>Time:</strong> {format(parseISO(activeTrip.flightDateTime), 'p')}</p>
                </CardContent>
              </Card>

              <div className="flex flex-col sm:flex-row gap-4">
                  <Button onClick={() => handleRunTest(false)} disabled={isTesting} className="w-full sm:w-auto">
                    {isTesting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Running Test...
                      </>
                    ) : (
                      <>
                        <TestTube2 className="mr-2 h-4 w-4" />
                        Test Against Real Data
                      </>
                    )}
                  </Button>
                   <Button onClick={() => handleRunTest(true)} disabled={isTesting} className="w-full sm:w-auto" variant="secondary">
                    {isTesting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Running Test...
                      </>
                    ) : (
                       <>
                        <Beaker className="mr-2 h-4 w-4" />
                        Test Against Faux Data
                       </>
                    )}
                  </Button>
              </div>
            </>
          )}

          {testResult && (
            <div className="space-y-6 pt-4">
              <Separator />
              <h3 className="text-xl font-semibold">Test Results</h3>
              
              <Card>
                <CardHeader>
                   <CardTitle className="text-lg">Best Match Found</CardTitle>
                </CardHeader>
                <CardContent>
                    {testResult.bestMatch ? (
                        <div className="flex items-center gap-4 p-4 bg-green-500/10 border border-green-500/20 rounded-md">
                           <CheckCircle2 className="h-8 w-8 text-green-600"/>
                           <div>
                                <p className="font-bold">{testResult.bestMatch.userName}</p>
                                <p className="text-sm text-muted-foreground">{testResult.bestMatch.flightCode} at {format(parseISO(testResult.bestMatch.flightDateTime), 'p')}</p>
                           </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                            <XCircle className="h-8 w-8 text-yellow-600"/>
                            <p className="font-bold text-yellow-800">No suitable match was found from the available candidates.</p>
                        </div>
                    )}
                </CardContent>
              </Card>

              <Card>
                 <CardHeader>
                   <CardTitle className="text-lg">Candidate Analysis ({testResult.candidates.length})</CardTitle>
                   <CardDescription>Here is a list of all trips considered and why they were or were not matched.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {testResult.candidates.length === 0 ? (
                    <p className="text-muted-foreground italic">No other pending trips were found for your university.</p>
                  ) : (
                    testResult.candidates.map(candidate => (
                      <div key={candidate.id} className="p-4 border rounded-md shadow-sm">
                        <div className="flex justify-between items-start">
                            <div>
                               <p className="font-bold flex items-center gap-2"><User className="h-4 w-4" /> {candidate.userName}</p>
                               <p className="text-sm text-muted-foreground">{candidate.flightCode} @ {format(parseISO(candidate.flightDateTime), 'Pp')}</p>
                            </div>
                            <div className="text-right">
                                {testResult.reasoning.get(candidate.id)?.includes('Selected') ? (
                                    <span className="flex items-center gap-2 text-green-600 font-semibold"><ResultIcon isMatch={true} /> Best Match</span>
                                ) : testResult.reasoning.get(candidate.id)?.includes('Eligible') ? (
                                     <span className="flex items-center gap-2 text-blue-600 font-semibold"><ResultIcon isMatch={true} /> Eligible</span>
                                ) : (
                                    <span className="flex items-center gap-2 text-destructive font-semibold"><ResultIcon isMatch={false} /> Rejected</span>
                                )}
                            </div>
                        </div>
                        <Separator className="my-2"/>
                        <p className="text-xs text-foreground/80 bg-muted p-2 rounded-md">
                           <strong>Reasoning:</strong> {testResult.reasoning.get(candidate.id) || "No specific reason logged."}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
              
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
