'use client';

/**
 * Dev-only matching dashboard.
 *
 * - Hidden in production: returns 404-like message if NODE_ENV !== 'development'.
 * - Seed repeatable scenarios (presets) with one click.
 * - Lists every `tripRequests` document with status='pending'.
 * - Lets you pick a time window (in hours from now) and invoke the
 *   `manualPairing` Cloud Function.
 * - "Act as" button next to each pool row mints a session cookie for that
 *   synthetic user so you can walk through the real UI (chat, profile, etc.).
 */

import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, app } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, RefreshCw, Play, Trash2, AlertTriangle, Sprout, UserRound } from 'lucide-react';
import type { TripRequest, Match } from '@/lib/types';
import { useRouter } from 'next/navigation';

type PoolRow = TripRequest & { id: string };
type PresetOption = { key: string; label: string };

export default function DevMatchingPage() {
  const isDev = process.env.NODE_ENV === 'development';
  const router = useRouter();
  const [pool, setPool] = useState<PoolRow[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [from, setFrom] = useState(3);
  const [to, setTo] = useState(24);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [presets, setPresets] = useState<PresetOption[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [presetHours, setPresetHours] = useState<number>(5);
  const [impersonating, setImpersonating] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = query(
        collection(db, 'tripRequests'),
        where('status', '==', 'pending'),
        orderBy('flightDateTime', 'asc'),
        limit(200),
      );
      const snap = await getDocs(q);
      setPool(snap.docs.map(d => ({ ...(d.data() as TripRequest), id: d.id })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pool.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isDev) return;
    reload();

    fetch('/api/dev/seed-preset', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('preset list failed'))))
      .then((data: { presets: PresetOption[] }) => {
        setPresets(data.presets);
        if (data.presets[0]) setSelectedPreset(data.presets[0].key);
      })
      .catch(() => {
        /* non-fatal */
      });

    const q = query(collection(db, 'matches'), orderBy('assignedAtISO', 'desc'), limit(25));
    const unsub = onSnapshot(q, (snap) => {
      setMatches(snap.docs.map(d => ({ ...(d.data() as Match), id: d.id })));
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerPairing = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const fns = getFunctions(app);
      const manualPairing = httpsCallable(fns, 'manualPairing');
      const res = await manualPairing({ from, to });
      setResult(res.data);
      await reload();
    } catch (e) {
      setError(
        e instanceof Error
          ? `${e.message} (Are functions deployed? Run \`npm run deploy:functions\`.)`
          : 'manualPairing failed.'
      );
    } finally {
      setRunning(false);
    }
  };

  const seedPreset = async () => {
    if (!selectedPreset) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/dev/seed-preset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ preset: selectedPreset, hoursFromNow: presetHours }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Seed failed');
      setResult(data);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Seed failed.');
    } finally {
      setRunning(false);
    }
  };

  const impersonateUser = async (uid: string) => {
    setImpersonating(uid);
    setError(null);
    try {
      const res = await fetch('/api/dev/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ uid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Impersonation failed');
      router.push('/main');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impersonation failed.');
    } finally {
      setImpersonating(null);
    }
  };

  const cleanSynthetic = async () => {
    if (!confirm('Delete every trip flagged synthetic:true?')) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/dev/matching/clean', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Clean failed');
      setResult(data);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Clean failed.');
    } finally {
      setRunning(false);
    }
  };

  const grouped = useMemo(() => {
    const m = new Map<string, PoolRow[]>();
    for (const t of pool) {
      const key = `${t.university} - ${t.departingAirport}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(t);
    }
    return Array.from(m.entries());
  }, [pool]);

  if (!isDev) {
    return (
      <div className="max-w-xl mx-auto p-8">
        <Card>
          <CardHeader>
            <CardTitle>Not available</CardTitle>
            <CardDescription>This page is only visible when running in development mode.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-headline">Matching Dashboard</h1>
        <p className="text-sm text-muted-foreground">Dev-only. Use this to test the pairing engine end-to-end.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Seed scenario preset</CardTitle>
          <CardDescription>
            Spin up a repeatable matching scenario (synthetic users + trips). Safe to re-run;
            use &quot;Delete synthetic trips&quot; below to clean up.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px]">
              <Label htmlFor="preset">Preset</Label>
              <select
                id="preset"
                className="w-full mt-1 rounded-md border bg-background px-3 py-2 text-sm"
                value={selectedPreset}
                onChange={(e) => setSelectedPreset(e.target.value)}
                disabled={running || presets.length === 0}
              >
                {presets.length === 0 && <option value="">Loading...</option>}
                {presets.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="presetHours">Flight in (hrs from now)</Label>
              <Input
                id="presetHours"
                type="number"
                min={1}
                value={presetHours}
                onChange={(e) => setPresetHours(parseFloat(e.target.value) || 5)}
                className="w-28"
              />
            </div>
            <Button onClick={seedPreset} disabled={running || !selectedPreset}>
              {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sprout className="mr-2 h-4 w-4" />}
              Seed preset
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            After seeding, adjust the pairing window below to bracket the flight time, then click
            &quot;Run manualPairing.&quot;
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trigger pairing</CardTitle>
          <CardDescription>
            Calls the <code>manualPairing</code> Cloud Function. The window is &quot;flights N-M hours from now.&quot;
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="from">From (hrs)</Label>
              <Input id="from" type="number" min={0} value={from} onChange={(e) => setFrom(parseInt(e.target.value, 10) || 0)} className="w-24" />
            </div>
            <div>
              <Label htmlFor="to">To (hrs)</Label>
              <Input id="to" type="number" min={1} value={to} onChange={(e) => setTo(parseInt(e.target.value, 10) || 1)} className="w-24" />
            </div>
            <Button onClick={triggerPairing} disabled={running}>
              {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Run manualPairing
            </Button>
            <Button variant="outline" onClick={reload} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Reload pool
            </Button>
            <Button variant="destructive" onClick={cleanSynthetic} disabled={running}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete synthetic trips
            </Button>
          </div>

          {error && (
            <div className="mt-4 p-3 border border-destructive bg-destructive/10 rounded-md text-destructive text-sm">
              <AlertTriangle className="inline h-4 w-4 mr-2" />
              {error}
            </div>
          )}

          {result != null && (
            <pre className="mt-4 p-3 bg-muted rounded-md text-xs overflow-auto">{JSON.stringify(result, null, 2)}</pre>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending pool ({pool.length})</CardTitle>
          <CardDescription>All <code>tripRequests</code> with status=&quot;pending&quot;.</CardDescription>
        </CardHeader>
        <CardContent>
          {pool.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing pending. Run <code>node scripts/seed-test-trips.mjs</code> or seed a preset above.
            </p>
          ) : (
            <div className="space-y-6">
              {grouped.map(([key, trips]) => (
                <div key={key}>
                  <h3 className="font-medium text-sm mb-2">{key} <span className="text-muted-foreground">({trips.length})</span></h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left p-2">Name</th>
                          <th className="text-left p-2">Flight</th>
                          <th className="text-left p-2">Departure</th>
                          <th className="text-left p-2">Bags (carry/check)</th>
                          <th className="text-left p-2">Gender / Pref</th>
                          <th className="text-left p-2">Campus</th>
                          <th className="text-left p-2">Act as</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trips.map(t => (
                          <tr key={t.id} className="border-t">
                            <td className="p-2">{t.userName ?? '-'}</td>
                            <td className="p-2">{t.flightCode}</td>
                            <td className="p-2">{new Date(t.flightDateTime).toLocaleString()}</td>
                            <td className="p-2">{t.numberOfCarryons} / {t.numberOfCheckedBags}</td>
                            <td className="p-2">{t.userGender} / {t.userPreferences}</td>
                            <td className="p-2">{t.campusArea ?? '-'}</td>
                            <td className="p-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => impersonateUser(t.userId)}
                                disabled={impersonating === t.userId}
                                title="Sign in as this synthetic user (dev only)"
                              >
                                {impersonating === t.userId
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : <UserRound className="h-3 w-3" />}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent matches ({matches.length})</CardTitle>
          <CardDescription>Live feed of the <code>matches</code> collection (newest first).</CardDescription>
        </CardHeader>
        <CardContent>
          {matches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No matches yet.</p>
          ) : (
            <ul className="space-y-2">
              {matches.map(m => (
                <li key={m.id} className="border rounded-md p-3 text-xs">
                  <div className="font-medium">
                    {m.matchTier ?? 'standard'} - {m.university} - {m.departingAirport}
                    <span className="text-muted-foreground"> - {new Date(m.assignedAtISO).toLocaleString()}</span>
                  </div>
                  <div className="mt-1">
                    {Object.values(m.participants).map(p => (
                      <span key={p.userId} className="mr-3">
                        {p.userName} (flight {p.flightCode} @ {new Date(p.flightDateTime).toLocaleTimeString()})
                      </span>
                    ))}
                  </div>
                  {m.reason && <div className="mt-1 text-muted-foreground">{m.reason}</div>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
