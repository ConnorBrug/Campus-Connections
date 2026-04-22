'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { CarFront } from 'lucide-react';
import Link from 'next/link';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // The `digest` is Next's server-assigned error ID - the only way to
  // correlate a user-facing "Something went wrong" with the redacted
  // server log in production. Log it so it shows up in browser
  // breadcrumbs / Sentry / whatever error tracker we wire up later.
  useEffect(() => {
    console.error('[app/error]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
      <CarFront className="h-16 w-16 text-primary mb-6" />
      <h1 className="text-3xl font-bold font-headline mb-2">Something went wrong</h1>
      <p className="text-muted-foreground mb-4 max-w-md">
        An unexpected error occurred. You can try again or head back to the home page.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground/70 mb-8 font-mono">
          Error ID: {error.digest}
        </p>
      )}
      <div className="flex gap-4">
        <Button onClick={reset}>Try Again</Button>
        <Button variant="outline" asChild>
          <Link href="/">Go Home</Link>
        </Button>
      </div>
    </div>
  );
}
