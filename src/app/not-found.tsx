import { Button } from '@/components/ui/button';
import { CarFront } from 'lucide-react';
import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
      <CarFront className="h-16 w-16 text-primary mb-6" />
      <h1 className="text-5xl font-bold font-headline mb-2">404</h1>
      <p className="text-xl text-muted-foreground mb-8">
        This page doesn&apos;t exist.
      </p>
      <Button asChild>
        <Link href="/">Go Home</Link>
      </Button>
    </div>
  );
}
