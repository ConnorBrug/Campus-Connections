'use client';

import { CarFront } from 'lucide-react';
import Link from 'next/link';

function AuthHeader() {
  return (
    <header className="absolute top-0 flex h-16 w-full items-center border-b bg-primary px-4 shadow-sm md:px-6">
      <Link href="/" className="flex items-center gap-2 text-2xl font-bold text-primary-foreground">
        <CarFront className="h-8 w-8 text-primary-foreground" />
        <span className="font-headline">Connections</span>
      </Link>
    </header>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <AuthHeader />
      {/* keep top padding so nothing hides under the absolute header */}
      <main className="flex flex-1 items-center justify-center p-4 pt-16">
        {/* pull content up by half the header height (h-16 -> 4rem -> half = 2rem = mt-8) */}
        <div className="-mt-8 w-full flex items-center justify-center">
          {children}
        </div>
      </main>
    </div>
  );
}
