import { Button } from '@/components/ui/button';
import { CarFront, Home, Compass } from 'lucide-react';
import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center bg-gradient-to-br from-background to-accent/30">
      <div className="flex flex-col items-center max-w-md">
        <div className="rounded-full bg-primary/10 p-5 mb-6">
          <CarFront className="h-14 w-14 text-primary" aria-hidden="true" />
        </div>
        <h1 className="text-5xl font-bold font-headline mb-2">404</h1>
        <p className="text-xl text-foreground/80 mb-3">
          We can&apos;t find that page.
        </p>
        <p className="text-muted-foreground mb-8">
          It may have moved, or the link might be a little off. Let&apos;s get you
          back to somewhere useful.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Button asChild>
            <Link href="/" className="inline-flex items-center gap-2">
              <Home className="h-4 w-4" aria-hidden="true" />
              Back home
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/signup" className="inline-flex items-center gap-2">
              <Compass className="h-4 w-4" aria-hidden="true" />
              Get started
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
