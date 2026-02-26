'use client';

import { Button } from '@/components/ui/button';
import { CarFront } from 'lucide-react';
import Link from 'next/link';

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
      <CarFront className="h-16 w-16 text-primary mb-6" />
      <h1 className="text-3xl font-bold font-headline mb-2">Something went wrong</h1>
      <p className="text-muted-foreground mb-8 max-w-md">
        An unexpected error occurred. You can try again or head back to the home page.
      </p>
      <div className="flex gap-4">
        <Button onClick={reset}>Try Again</Button>
        <Button variant="outline" asChild>
          <Link href="/">Go Home</Link>
        </Button>
      </div>
    </div>
  );
}
