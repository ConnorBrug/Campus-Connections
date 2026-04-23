'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { CarFront, RotateCcw, Home, AlertTriangle } from 'lucide-react';
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
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center bg-gradient-to-br from-background to-accent/30">
      <div className="flex flex-col items-center max-w-md">
        <div className="relative mb-6">
          <div className="rounded-full bg-primary/10 p-5">
            <CarFront className="h-14 w-14 text-primary" aria-hidden="true" />
          </div>
          <span className="absolute -bottom-1 -right-1 rounded-full bg-destructive text-destructive-foreground p-1.5 shadow">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
        <h1 className="text-3xl font-bold font-headline mb-3">
          Something went wrong
        </h1>
        <p className="text-muted-foreground mb-6">
          We hit a snag on our end. Sorry about that — try again, and if it keeps
          happening, head back home and give it another go in a minute.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/70 mb-6 font-mono break-all">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Button onClick={reset} className="inline-flex items-center gap-2">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Try again
          </Button>
          <Button variant="outline" asChild>
            <Link href="/" className="inline-flex items-center gap-2">
              <Home className="h-4 w-4" aria-hidden="true" />
              Back home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
