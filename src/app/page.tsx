
'use client';

import { Button } from "@/components/ui/button";
import { CarFront, Users, Plane, PiggyBank, Handshake, CheckCircle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";

export default function HomePage() {
  const [currentYear, setCurrentYear] = useState<number | null>(null);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-50 w-full border-b bg-primary shadow-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2 text-2xl font-bold text-primary-foreground">
            <CarFront className="h-8 w-8 text-primary-foreground" />
            <span className="font-headline">Connections</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="text-primary-foreground hover:bg-primary/80 hover:text-white">
              <Link href="/signup">Sign Up</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild className="text-primary-foreground hover:bg-primary/80 hover:text-white">
              <Link href="/login">Login</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-12 md:py-24 lg:py-32 bg-gradient-to-br from-background to-accent/30">
          <div className="container mx-auto px-4 md:px-6 text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl font-headline text-primary-foreground/90">
              Share Rides, Save Money.
            </h1>
            <p className="mt-8 max-w-2xl mx-auto text-lg text-foreground/80 md:text-xl">
              Connections brings university students together for affordable airport rides. Find your match based on flight times and bag count.
            </p>
            <div className="mt-10 flex justify-center gap-4">
              <Button size="lg" asChild>
                <Link href="/signup">Get Started</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">Login</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-12 md:py-24 bg-background">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-3xl font-bold text-center mb-12 font-headline text-primary-foreground/90">How It Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="flex flex-col items-center text-center p-6 bg-card rounded-lg shadow-lg">
                <Plane className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2 font-headline">Enter Trip Details</h3>
                <p className="text-muted-foreground">Input your flight time, number of bags, and departure airport.</p>
              </div>
              <div className="flex flex-col items-center text-center p-6 bg-card rounded-lg shadow-lg">
                <Users className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2 font-headline">Find Matches</h3>
                <p className="text-muted-foreground">Our system finds students from your campus with similar travel plans.</p>

              </div>
              <div className="flex flex-col items-center text-center p-6 bg-card rounded-lg shadow-lg">
                <CarFront className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2 font-headline">Coordinate & Ride</h3>
                <p className="text-muted-foreground">Chat with your match, arrange pickup, and share the ride!</p>
              </div>
            </div>
          </div>
        </section>

        {/* Stress-Free Section */}
        <section className="py-12 md:py-24 bg-gradient-to-br from-background to-accent/30">
          <div className="container mx-auto px-4 md:px-6">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl font-bold font-headline text-primary-foreground/90">Stress-Free Airport Travel</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Our smart matching system ensures your journey is not just cheaper but makes it easy to connect and coordinate with fellow students.
              </p>
            </div>
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="flex items-start gap-4">
                <PiggyBank className="h-10 w-10 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-xl font-semibold font-headline">Affordable</h3>
                  <p className="text-muted-foreground mt-1">Split the cost of your ride and save more for your trip.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                 <Handshake className="h-10 w-10 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-xl font-semibold font-headline">Connected</h3>
                  <p className="text-muted-foreground mt-1">Travel with a fellow student from your campus.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                 <CheckCircle className="h-10 w-10 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-xl font-semibold font-headline">Simple</h3>
                  <p className="text-muted-foreground mt-1">Just enter your flight details and we handle the matching. It's that easy.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-8 text-center bg-background border-t">
        <p className="text-sm text-muted-foreground">
          &copy; {currentYear} Connections. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
