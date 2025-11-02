
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { CheckCircle, CalendarDays } from 'lucide-react';

export default function TripSubmittedPage() {

  return (
    <div className="container mx-auto py-10 px-4 md:px-6 flex flex-col items-center">
      <Card className="w-full max-w-lg shadow-xl rounded-lg">
        <CardHeader className="text-center pt-8 pb-6 border-b">
          <div className="flex justify-center mb-6">
            <CheckCircle className="h-20 w-20 text-green-500" />
          </div>
          <CardTitle className="text-3xl md:text-4xl font-headline tracking-tight">Request Received!</CardTitle>
          <CardDescription className="text-lg text-muted-foreground mt-2 px-4">
            We look forward to connecting you with someone soon.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8">
            <p className="text-muted-foreground">
                We'll notify you here on your dashboard once a match is found. Remember, most matches are made about 24 hours before a flight.
            </p>
        </CardContent>
        <CardFooter className="flex justify-center bg-muted/50 p-4 border-t">
             <Button asChild size="lg">
                <Link href="/dashboard">
                    <CalendarDays className="mr-2 h-5 w-5" /> Return to Dashboard
                </Link>
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
