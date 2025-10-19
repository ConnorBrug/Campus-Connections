
'use client';

import { CarFront } from 'lucide-react';
import Link from 'next/link';

function AuthHeader() {
  return (
    <header className="flex h-16 w-full items-center justify-center border-b bg-primary px-4 shadow-sm md:px-6">
      <div className="flex w-full max-w-md items-center">
        <Link href="/" className="flex items-center gap-2 text-2xl font-bold text-primary-foreground">
          <CarFront className="h-8 w-8 text-primary-foreground" />
          <span className="font-headline">Connections</span>
        </Link>
      </div>
    </header>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center">
      <AuthHeader />
      <main className="flex flex-1 w-full items-center justify-center p-4">
        {children}
      </main>
    </div>
  );
}
