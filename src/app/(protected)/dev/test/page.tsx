'use client';

/**
 * Dev-only one-click scenario runner.
 *
 * `/dev/matching` exposes every knob (pairing window, preset hours, pool,
 * matches feed). This page is the friendly front door: each card runs a full
 * scenario in one click — seed the synthetic users + trips, invoke
 * manualPairing, then surface "sign in as" shortcuts so you can walk through
 * the real UI from any participant's perspective.
 *
 * Gated by NODE_ENV !== 'production' (same as every /dev/* route).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import { app, auth } from '@/lib/firebase';

import { Button } from '@/components/ui/button';
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  Loader2, Play, Trash2, UserRound, ArrowRight, CheckCircle2, AlertTriangle, FlaskConical, Settings,
} from 'lucide-react';

/**
 * One row per scenario. `key` must match a preset key in
 * src/lib/dev/presets.mjs. `expected` is a plain-English description of what
 * the pairing engine should produce for this scenario so you can eyeball the
 * result without remembering the matching rules.
 */
type Scenario = {
  key: string;
  title: string;
  blurb: string;
  expected: string;
};
const SCENARIOS: Scenario[] = [
  {
    key: 'same-flight-pair',
    title: 'Happy path: standard pair',
    blurb: '2 riders, same flight, same campus, compatible prefs.',
    expected: '1 standard match, both riders status=matched.',
  },
  {
    key: 'group-of-4-light',
    title: 'Group of 4 (light bags)',
    blurb: '4 riders, same flight, all light bags.',
    expected: '1 group match containing all 4 riders.',
  },
  {
    key: 'mixed-pair-plus-xl',
    title: 'Pair + one heavy rider',
    blurb: 'A compatible pair plus one heavy-bagged third.',
    expected: 'The pair matches standard; the third gets xl-suggested.',
  },
  {
    key: 'xl-heavy-trio',
    title: 'Heavy trio → XL-suggested',
    blurb: '3 riders, too many bags for a standard pair.',
    expected: 'All 3 pending with xlRideSuggested=true (email sent).',
  },
  {
    key: 'gender-incompatible',
    title: 'Gender mismatch → relaxed-gender',
    blurb: '2 riders with mutually incompatible gender prefs.',
    expected: 'relaxed-gender fallback match (or still pending if strict).',
  },
  {
    key: 'two-hour-gap',
    title: '90-min gap → relaxed-time',
    blurb: 'Same campus but flights ~90 min apart.',
    expected: 'relaxed-time fallback match in the 2h window.',
  },
  {
    key: 'relaxed-campus',
    title: 'Different campus → relaxed-campus',
    blurb: 'Same airport, different BC campus areas.',
    expected: 'relaxed-campus fallback match.',
  },
  {
    key: 'no-match-warning',
    title: 'Lone rider (no-match warning)',
    blurb: '1 rider with nobody to match against.',
    expected: 'noMatchWarningSent=true after fallback tier 5.',
  },
];

/** Per-scenario result shown inside the card after "Run" completes. */
type ScenarioResult = {
  status: 'ok' | 'error';
  presetKey: string;
  hoursFromNow: number;
  userIds: string[];
  userNames: Record<string, string>;
  pairingOutcome?: unknown;
  errorMessage?: string;
};

/** Fetch the full name for each seeded uid so the impersonation buttons can
 *  show "Sign in as Alex Ramos" instead of a synthetic-${key}-${runId}-0 id. */
async function fetchUserNames(userIds: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    userIds.map(async (uid) => {
      try {
        const res = await fetch(`/api/profile?uid=${encodeURIComponent(uid)}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.profile?.name) out[uid] = data.profile.name as string;
        }
      } catch {
        /* best-effort — leave blank */
      }
    }),
  );
  return out;
}

export default function DevTestPage() {
  const isDev = process.env.NODE_ENV === 'development';
  const router = useRouter();

  const [running, setRunning] = useState<string | null>(null);
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ScenarioResult>>({});

  // `useRouter().push` alone doesn't force the app shell to refetch the session
  // cookie the impersonate endpoint just set. Hard-navigate instead.
  const goToDashboard = () => {
    window.location.href = '/dashboard';
  };

  const runScenario = async (scenario: Scenario) => {
    setRunning(scenario.key);
    setResults((prev) => ({ ...prev, [scenario.key]: { ...(prev[scenario.key] ?? {} as ScenarioResult), errorMessage: undefined } }));
    const hoursFromNow = 5;
    try {
      // 1. Seed synthetic users + trips.
      const seedRes = await fetch('/api/dev/seed-preset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ preset: scenario.key, hoursFromNow }),
      });
      const seedData = await seedRes.json();
      if (!seedRes.ok) throw new Error(seedData?.error || 'Seed failed.');
      const userIds: string[] = Array.isArray(seedData?.userIds) ? seedData.userIds : [];

      // 2. Run pairing. We call a local Next.js route (/api/dev/matching/run)
      //    that ports the Cloud Function logic to Admin SDK — this works
      //    without a functions deploy, which is the common dev case. We
      //    ALSO fire manualPairing best-effort so if functions are deployed
      //    they stay exercised; its failure is logged but non-fatal.
      const pairingOutcome: {
        local?: unknown;
        cloud?: unknown;
        cloudError?: string;
        localError?: string;
      } = {};

      try {
        const localRes = await fetch('/api/dev/matching/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            from: Math.max(1, hoursFromNow - 2),
            to: hoursFromNow + 2,
          }),
        });
        const localData = await localRes.json();
        if (!localRes.ok) throw new Error(localData?.error || 'Local pairing failed');
        pairingOutcome.local = localData;
      } catch (localErr) {
        pairingOutcome.localError =
          localErr instanceof Error ? localErr.message : 'Local pairing failed';
      }

      try {
        const fns = getFunctions(app);
        const manualPairing = httpsCallable(fns, 'manualPairing');
        const resp = await manualPairing({
          from: Math.max(1, hoursFromNow - 2),
          to: hoursFromNow + 2,
        });
        pairingOutcome.cloud = resp.data;
      } catch (pairErr) {
        pairingOutcome.cloudError =
          pairErr instanceof Error ? pairErr.message : 'manualPairing failed';
      }

      // 3. Fetch names for nice "sign in as" labels.
      const userNames = await fetchUserNames(userIds);

      setResults((prev) => ({
        ...prev,
        [scenario.key]: {
          status: 'ok',
          presetKey: scenario.key,
          hoursFromNow,
          userIds,
          userNames,
          pairingOutcome,
        },
      }));
    } catch (e) {
      setResults((prev) => ({
        ...prev,
        [scenario.key]: {
          status: 'error',
          presetKey: scenario.key,
          hoursFromNow,
          userIds: [],
          userNames: {},
          errorMessage: e instanceof Error ? e.message : 'Scenario failed.',
        },
      }));
    } finally {
      setRunning(null);
    }
  };

  const impersonate = async (uid: string) => {
    setImpersonating(uid);
    try {
      // Sign out any currently-signed-in user on the client SDK first so the
      // custom-token sign-in below doesn't collide with an existing session
      // (e.g. you signing in as yourself before running this page).
      try { await signOut(auth); } catch { /* no-op */ }

      const res = await fetch('/api/dev/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ uid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Impersonation failed.');

      // The server cookie is set, but the client Firebase SDK is still
      // logged out — so any client-side Firestore query (getActiveTripForUser,
      // etc.) would fail security rules. Sign in with the custom token the
      // route returned so both the server cookie AND the client SDK are in
      // sync as the impersonated user.
      if (data?.customToken) {
        await signInWithCustomToken(auth, data.customToken);
      }

      goToDashboard();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Impersonation failed.');
      setImpersonating(null);
    }
  };

  const cleanSynthetic = async () => {
    if (!confirm('Delete every synthetic user + trip created by the preset seeder?')) return;
    setCleaning(true);
    setCleanResult(null);
    try {
      const res = await fetch('/api/dev/matching/clean', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Clean failed.');
      setCleanResult(`Cleaned: ${JSON.stringify(data)}`);
      // After cleanup, our scenario results point at dead uids — clear them.
      setResults({});
    } catch (e) {
      setCleanResult(e instanceof Error ? e.message : 'Clean failed.');
    } finally {
      setCleaning(false);
    }
  };

  // Double-lock: NODE_ENV gate + a visible "dev only" banner so nobody loads
  // this on the staging URL and wonders why it's exposing pairing internals.
  if (!isDev) {
    return (
      <div className="max-w-xl mx-auto p-8">
        <Card>
          <CardHeader>
            <CardTitle>Not available</CardTitle>
            <CardDescription>This page is only visible in development mode.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-headline">
            <FlaskConical className="h-7 w-7 text-primary" /> Scenario Tester
          </h1>
          <p className="text-sm text-muted-foreground">
            One-click end-to-end tests. Each card seeds synthetic users, triggers the
            pairing engine, then lets you sign in as any participant to eyeball the UI.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            For raw controls (pairing window, pool inspector, match feed) use{' '}
            <Link href="/dev/matching" className="underline hover:text-primary">
              /dev/matching
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/dev/matching">
              <Settings className="mr-2 h-4 w-4" /> Advanced
            </Link>
          </Button>
          <Button variant="destructive" onClick={cleanSynthetic} disabled={cleaning}>
            {cleaning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Clean synthetic data
          </Button>
        </div>
      </div>

      {cleanResult && (
        <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          {cleanResult}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SCENARIOS.map((scenario) => {
          const isThisRunning = running === scenario.key;
          const result = results[scenario.key];

          return (
            <Card key={scenario.key} className="flex flex-col shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">{scenario.title}</CardTitle>
                <CardDescription>{scenario.blurb}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-3 text-sm">
                <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Expected:</span> {scenario.expected}
                </div>

                {result?.status === 'error' && (
                  <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-xs text-destructive">
                    <AlertTriangle className="inline h-3 w-3 mr-1" />
                    {result.errorMessage}
                  </div>
                )}

                {result?.status === 'ok' && (
                  <div className="rounded-md border border-green-600/50 bg-green-600/5 p-3 space-y-2">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-green-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Seeded {result.userIds.length} user{result.userIds.length === 1 ? '' : 's'}.
                      Pairing dispatched.
                    </p>

                    {/* Raw pairing output — this is what manualPairing returned,
                        so you can eyeball whether the algorithm agreed with the
                        scenario's "Expected:" line above. */}
                    <details className="text-[11px] leading-tight text-green-900/80">
                      <summary className="cursor-pointer font-medium">Pairing output (JSON)</summary>
                      <pre className="mt-1 max-h-48 overflow-auto rounded bg-background/70 p-2 border">
{JSON.stringify(result.pairingOutcome, null, 2)}
                      </pre>
                    </details>
                    <div className="flex flex-col gap-1.5">
                      {result.userIds.map((uid) => {
                        const name = result.userNames[uid] || uid;
                        return (
                          <Button
                            key={uid}
                            size="sm"
                            variant="outline"
                            className="justify-start text-xs"
                            disabled={impersonating === uid}
                            onClick={() => impersonate(uid)}
                          >
                            {impersonating === uid ? (
                              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            ) : (
                              <UserRound className="mr-2 h-3 w-3" />
                            )}
                            Sign in as {name}
                            <ArrowRight className="ml-auto h-3 w-3" />
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>

              <CardFooter className="mt-auto">
                <Button
                  className="w-full"
                  disabled={isThisRunning || !!running}
                  onClick={() => runScenario(scenario)}
                >
                  {isThisRunning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running…
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" /> {result ? 'Re-run scenario' : 'Run scenario'}
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <Card className="bg-muted/20">
        <CardHeader>
          <CardTitle className="text-base">How to use this page</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            1. Pick a scenario and click <strong>Run scenario</strong>. The seeder writes synthetic
            users + trips (5 hours in the future by default) and immediately runs pairing against a
            window of [3h, 7h] via the local <code>/api/dev/matching/run</code> route (which ports
            the Cloud Function&apos;s logic). The deployed <code>manualPairing</code> is also called
            best-effort, but local pairing is what makes matches visible in dev.
          </p>
          <p>
            2. Click <strong>Sign in as {'{name}'}</strong> to impersonate any seeded participant —
            you&apos;ll land on <code>/dashboard</code>. For a successful scenario (e.g. the
            same-flight pair) the right-hand status card should say &quot;You&apos;re matched!&quot;
            with a <strong>Go to Chat</strong> button.
          </p>
          <p>
            3. When you&apos;re done testing, click <strong>Clean synthetic data</strong> at the top
            to wipe everything. Real user data is never touched (the impersonate and clean routes
            both refuse to operate on docs without <code>synthetic:true</code>).
          </p>
          <p className="text-xs">
            Expand <em>Pairing output (JSON)</em> on the card to see exactly what the matcher did —
            including the local run&apos;s breakdown (pairs / groups / xl-suggested / no-match
            warnings) and the cloud call&apos;s result or error.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
