
'use client';

import { Button } from "@/components/ui/button";
import {
  CarFront,
  Users,
  Plane,
  PiggyBank,
  Handshake,
  CheckCircle,
  ShieldCheck,
  GraduationCap,
  Clock,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function HomePage() {
  const [currentYear, setCurrentYear] = useState<number | null>(null);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      {/* ---------- Header ---------- */}
      <header className="sticky top-0 z-50 w-full border-b bg-primary shadow-sm">
        <div className="flex h-16 w-full items-center justify-between px-4 md:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-2xl font-bold text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            aria-label="Campus Connections home"
          >
            <CarFront className="h-8 w-8 text-primary-foreground" aria-hidden="true" />
            <span className="font-headline">Campus Connections</span>
          </Link>
          <nav className="flex items-center gap-2" aria-label="Primary">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-primary-foreground hover:bg-primary/80 hover:text-white"
            >
              <Link href="/login">Log In</Link>
            </Button>
            <Button
              size="sm"
              asChild
              className="bg-white text-primary hover:bg-white/90"
            >
              <Link href="/signup">Sign Up</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* ---------- Hero ---------- */}
        <section className="py-16 md:py-24 lg:py-32 bg-gradient-to-br from-background to-accent/30">
          <div className="container mx-auto px-4 md:px-6 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/60 px-4 py-1.5 text-sm text-foreground/80 mb-6 shadow-sm">
              <GraduationCap className="h-4 w-4 text-primary" aria-hidden="true" />
              <span>Verified students only</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl font-headline text-primary-foreground/90">
              Share airport rides.{" "}
              <span className="whitespace-nowrap">Split the fare.</span>
            </h1>
            <p className="mt-6 max-w-2xl mx-auto text-lg text-foreground/80 md:text-xl">
              Campus Connections matches you with classmates headed to the same airport
              around the same time. Cheaper than a taxi, friendlier than a shuttle.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row justify-center gap-3">
              <Button size="lg" asChild>
                <Link href="/signup" className="inline-flex items-center gap-2">
                  Get started — it's free
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">I already have an account</Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Sign in with your school Google or Microsoft account. No passwords to remember.
            </p>
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section className="py-16 md:py-24 bg-background">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-3xl font-bold text-center mb-3 font-headline text-primary-foreground/90">
              How it works
            </h2>
            <p className="text-center text-muted-foreground max-w-xl mx-auto mb-12">
              Three steps to a cheaper, more chill airport run.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              <div className="flex flex-col items-center text-center p-6 bg-card rounded-lg shadow-sm border">
                <div className="rounded-full bg-primary/10 p-3 mb-4">
                  <Plane className="h-8 w-8 text-primary" aria-hidden="true" />
                </div>
                <h3 className="text-xl font-semibold mb-2 font-headline">
                  1. Post your trip
                </h3>
                <p className="text-muted-foreground">
                  Tell us your flight time, airport, and how many bags you're hauling.
                  Takes under a minute.
                </p>
              </div>
              <div className="flex flex-col items-center text-center p-6 bg-card rounded-lg shadow-sm border">
                <div className="rounded-full bg-primary/10 p-3 mb-4">
                  <Users className="h-8 w-8 text-primary" aria-hidden="true" />
                </div>
                <h3 className="text-xl font-semibold mb-2 font-headline">
                  2. Get matched
                </h3>
                <p className="text-muted-foreground">
                  We pair you with verified students from your school flying around the
                  same time from the same airport.
                </p>
              </div>
              <div className="flex flex-col items-center text-center p-6 bg-card rounded-lg shadow-sm border">
                <div className="rounded-full bg-primary/10 p-3 mb-4">
                  <CarFront className="h-8 w-8 text-primary" aria-hidden="true" />
                </div>
                <h3 className="text-xl font-semibold mb-2 font-headline">
                  3. Ride together
                </h3>
                <p className="text-muted-foreground">
                  Chat, coordinate pickup, split the fare. That's it — no payments
                  run through us.
                </p>
              </div>
            </div>
            <div className="mt-12 flex justify-center">
              <Button size="lg" asChild>
                <Link href="/signup" className="inline-flex items-center gap-2">
                  Create your account
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ---------- Value prop / trust ---------- */}
        <section className="py-16 md:py-24 bg-gradient-to-br from-background to-accent/30">
          <div className="container mx-auto px-4 md:px-6">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl font-bold font-headline text-primary-foreground/90">
                Built for students. Run by students.
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Every rider is verified through their school email — so you always know
                who you're sharing a ride with.
              </p>
            </div>
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-4xl mx-auto">
              <div className="flex items-start gap-4 p-4 rounded-lg bg-card/40">
                <PiggyBank
                  className="h-10 w-10 text-primary flex-shrink-0 mt-1"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="text-xl font-semibold font-headline">Actually cheap</h3>
                  <p className="text-muted-foreground mt-1">
                    Split the fare 2–4 ways. Most rides work out to under $15 each.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 rounded-lg bg-card/40">
                <ShieldCheck
                  className="h-10 w-10 text-primary flex-shrink-0 mt-1"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="text-xl font-semibold font-headline">Verified students</h3>
                  <p className="text-muted-foreground mt-1">
                    Only people with an active <code>.edu</code> account from your school
                    can match with you.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 rounded-lg bg-card/40">
                <Handshake
                  className="h-10 w-10 text-primary flex-shrink-0 mt-1"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="text-xl font-semibold font-headline">Zero awkward</h3>
                  <p className="text-muted-foreground mt-1">
                    Pick your gender preference, bag tolerance, and campus area.
                    We do the rest.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 rounded-lg bg-card/40">
                <Clock
                  className="h-10 w-10 text-primary flex-shrink-0 mt-1"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="text-xl font-semibold font-headline">Fast matching</h3>
                  <p className="text-muted-foreground mt-1">
                    Most trips find a match within an hour of posting.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 rounded-lg bg-card/40">
                <CheckCircle
                  className="h-10 w-10 text-primary flex-shrink-0 mt-1"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="text-xl font-semibold font-headline">No commitment</h3>
                  <p className="text-muted-foreground mt-1">
                    Post a trip, see if it matches, cancel anytime before pickup.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 rounded-lg bg-card/40">
                <GraduationCap
                  className="h-10 w-10 text-primary flex-shrink-0 mt-1"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="text-xl font-semibold font-headline">On your campus</h3>
                  <p className="text-muted-foreground mt-1">
                    Started at Boston College. Expanding to more schools every semester.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Final CTA ---------- */}
        <section className="py-16 md:py-20 bg-primary">
          <div className="container mx-auto px-4 md:px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-bold font-headline text-primary-foreground mb-4">
              Your next airport run just got cheaper.
            </h2>
            <p className="text-primary-foreground/80 max-w-xl mx-auto mb-8">
              Sign up in 30 seconds with your school account. No credit card, no catch.
            </p>
            <Button size="lg" asChild className="bg-white text-primary hover:bg-white/90">
              <Link href="/signup" className="inline-flex items-center gap-2">
                Sign up free
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      {/* ---------- Footer ---------- */}
      <footer className="py-10 bg-background border-t">
        <div className="container mx-auto px-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CarFront className="h-5 w-5 text-primary" aria-hidden="true" />
            <span>
              &copy; {currentYear ?? ""} Campus Connections. All rights reserved.
            </span>
          </div>
          <nav
            aria-label="Footer"
            className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground"
          >
            <Link href="/privacy-policy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms-of-service" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Log in
            </Link>
            <Link href="/signup" className="hover:text-foreground">
              Sign up
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
