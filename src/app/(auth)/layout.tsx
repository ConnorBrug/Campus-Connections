
'use client';

import { CarFront } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

function AuthHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-primary shadow-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2 text-2xl font-bold text-primary-foreground">
            <CarFront className="h-8 w-8 text-primary-foreground" />
            <span className="font-headline">Connections</span>
          </Link>
        </div>
      </header>
  )
}


export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <AuthHeader />
      <main className="flex-1">{children}</main>
    </div>
  );
}
