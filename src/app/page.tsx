
'use client';

import { Button } from "@/components/ui/button";
import {
  CarFront,
  Users,
  Plane,
  PiggyBank,
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
        <div className="flex h-14 w-full items-center justify-between px-4 md:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-xl font-bold text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            aria-label="Campus Connections home"
          >
            <CarFront className="h-6 w-6 text-primary-foreground" aria-hidden="true" />
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
              className="bg-white text-foreground font-semibold hover:bg-white/90"
            >
              <Link href="/signup">Sign Up</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* ---------- Hero ---------- */}
        <section className="py-14 md:py-20 lg:py-28">
          <div className="container mx-auto px-4 md:px-6 text-center max-w-3xl">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl font-headline">
              Share airport rides.{" "}
              <span className="whitespace-nowrap">Split the fare.</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground">
              Match with classmates headed to the same airport. Cheaper than a taxi, friendlier than a shuttle.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
              <Button size="lg" asChild>
                <Link href="/signup" className="inline-flex items-center gap-2">
                  Get started free
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">Log in</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section className="py-14 md:py-20 bg-card">
          <div className="container mx-auto px-4 md:px-6 max-w-4xl">
            <h2 className="text-2xl font-bold text-center mb-10 font-headline">
              How it works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { icon: Plane, step: "1", title: "Post your trip", desc: "Enter your flight, airport, and bags." },
                { icon: Users, step: "2", title: "Get matched", desc: "We pair you with a verified student on the same route." },
                { icon: CarFront, step: "3", title: "Ride together", desc: "Chat, coordinate pickup, split the fare." },
              ].map((item) => (
                <div key={item.step} className="flex flex-col items-center text-center p-5 rounded-lg border bg-background">
                  <div className="rounded-full bg-primary/10 p-2.5 mb-3">
                    <item.icon className="h-6 w-6 text-primary" aria-hidden="true" />
                  </div>
                  <h3 className="font-semibold mb-1 font-headline">
                    {item.step}. {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Why students love it ---------- */}
        <section className="py-14 md:py-20">
          <div className="container mx-auto px-4 md:px-6 max-w-4xl">
            <h2 className="text-2xl font-bold text-center mb-10 font-headline">
              Why students love it
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { icon: PiggyBank, title: "Under $15/person", desc: "Split the fare 2-4 ways." },
                { icon: ShieldCheck, title: "Verified .edu only", desc: "Only students from your school." },
                { icon: Clock, title: "Fast matching", desc: "Most trips match within an hour." },
                { icon: GraduationCap, title: "Your campus", desc: "Started at BC, expanding every semester." },
                { icon: Users, title: "Your preferences", desc: "Gender, bags, campus area." },
                { icon: Plane, title: "No commitment", desc: "Cancel anytime before pickup." },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3 p-4 rounded-lg border bg-card">
                  <item.icon className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <h3 className="text-sm font-semibold">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Final CTA ---------- */}
        <section className="py-14 md:py-16 bg-primary">
          <div className="container mx-auto px-4 md:px-6 text-center max-w-2xl">
            <h2 className="text-2xl md:text-3xl font-bold font-headline text-primary-foreground mb-3">
              Your next airport run just got cheaper.
            </h2>
            <p className="text-sm text-primary-foreground/80 mb-6">
              30-second signup. No credit card.
            </p>
            <Button size="lg" asChild className="bg-white text-foreground font-semibold hover:bg-white/90">
              <Link href="/signup" className="inline-flex items-center gap-2">
                Sign up free
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      {/* ---------- Footer ---------- */}
      <footer className="py-6 bg-card border-t">
        <div className="container mx-auto px-4 md:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>&copy; {currentYear ?? ""} Campus Connections</span>
          <nav aria-label="Footer" className="flex items-center gap-4">
            <Link href="/privacy-policy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms-of-service" className="hover:text-foreground">Terms</Link>
            <Link href="/login" className="hover:text-foreground">Log in</Link>
            <Link href="/signup" className="hover:text-foreground">Sign up</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
