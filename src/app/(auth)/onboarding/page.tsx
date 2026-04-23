'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, UserCheck, AlertTriangle } from 'lucide-react';

import { getCurrentUser, updateUserProfile } from '@/lib/auth';
import { VALID_GENDERS } from '@/lib/types';
import type { UserProfile } from '@/lib/types';
import { normalizeName } from '@/lib/utils';

const currentYear = new Date().getFullYear();
const validYears = [currentYear + 1, currentYear + 2, currentYear + 3, currentYear + 4].map(String);

// US-only E.164: exactly "+1XXXXXXXXXX". PhoneInput always emits this shape,
// so the schema never needs to see a raw/formatted string.
const PHONE_RE = /^\+1[0-9]{10}$/;

// Feature flag: only show the phone + SMS opt-in block when Twilio is wired
// up. Flip by setting NEXT_PUBLIC_SMS_ENABLED=true in the deploy env (Vercel).
// When off, we never collect a phone number and the backend's silent-no-op
// SMS path keeps everything safe.
const SMS_ENABLED = process.env.NEXT_PUBLIC_SMS_ENABLED === 'true';

const Schema = z.object({
  firstName: z.string().min(1, 'First name is required.'),
  lastName: z.string().min(1, 'Last name is required.'),
  gender: z.enum(['Male', 'Female', 'Other', 'Prefer not to say'], { required_error: 'Please select your gender.' }),
  graduationYear: z.string({ required_error: 'Please select your graduation year.' })
    .refine(v => validYears.includes(v), { message: 'Please select a valid graduation year.' }),
  campusArea: z.string().optional(),
  // Phone is fully optional. If present it must look like a phone number.
  // SMS opt-in is downgraded silently at save time when no phone is provided.
  phoneNumber: z.string().optional().refine(
    (v) => !v || PHONE_RE.test(v),
    { message: 'Enter a valid US phone number or leave blank.' },
  ),
  smsNotificationsEnabled: z.boolean().optional(),
});

type FormValues = z.infer<typeof Schema>;
const toUndef = <T,>(v: T | null | undefined): T | undefined => (v == null ? undefined : v);

function splitNameSmart(full?: string | null) {
  const normalized = normalizeName(full || '');
  const tokens = normalized.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { first: '', last: '' };
  if (tokens.length === 1) return { first: tokens[0], last: '' };
  return { first: tokens.slice(0, -1).join(' '), last: tokens[tokens.length - 1] };
}

export default function OnboardingPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    // onTouched = don't paint the form red on first render. Labels only
    // highlight after the user has interacted with a field (and left it empty),
    // or after a failed submit when every missing field lights up with an
    // inline FormMessage. Matches TripDetailsForm's behaviour.
    mode: 'onTouched',
    defaultValues: {
      firstName: '',
      lastName: '',
      gender: undefined,
      graduationYear: undefined,
      campusArea: undefined,
      phoneNumber: '',
      smsNotificationsEnabled: false,
    },
  });

  useEffect(() => {
    (async () => {
      try {
        const me = await getCurrentUser();
        if (!me) return router.replace('/login');
        setProfile(me);

        const { first, last } = splitNameSmart(me.name);
        const gender = me.gender && VALID_GENDERS.includes(me.gender) ? (me.gender as FormValues['gender']) : undefined;
        const gradYear = me.graduationYear ? String(me.graduationYear) : undefined;
        const campus = me.university === 'Boston College' ? toUndef(me.campusArea) : undefined;

        form.reset({
          firstName: first,
          lastName: last,
          gender,
          graduationYear: gradYear,
          campusArea: campus,
          phoneNumber: me.phoneNumber ?? '',
          smsNotificationsEnabled: !!me.smsNotificationsEnabled,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load your profile.');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showCampus = useMemo(() => profile?.university === 'Boston College', [profile?.university]);

  const onSubmit = async (values: FormValues) => {
    if (!profile) return;
    setSaving(true);
    setError(null);

    if (showCampus && !values.campusArea) {
      setError('Please select your Boston College campus area.');
      setSaving(false);
      return;
    }

    try {
      const normalizedFullName = normalizeName(`${values.firstName} ${values.lastName}`);

      // PhoneInput always emits either "" or a validated "+1XXXXXXXXXX" E.164
      // string, so there's nothing to re-normalize here — just turn empty
      // into null so we clear the field instead of storing "".
      const phoneToSave = values.phoneNumber && values.phoneNumber.length > 0
        ? values.phoneNumber
        : null;

      await updateUserProfile(profile.id, {
        name: normalizedFullName,
        gender: values.gender,
        graduationYear: parseInt(values.graduationYear, 10),
        // When SMS is disabled at the feature-flag level we never persist a
        // phone number or opt-in boolean, even if the form had stale values.
        phoneNumber: SMS_ENABLED ? phoneToSave : null,
        smsNotificationsEnabled: SMS_ENABLED
          ? !!values.smsNotificationsEnabled && !!phoneToSave
          : false,
        ...(showCampus ? { campusArea: values.campusArea } : {}),
      });

      const next = new URLSearchParams(window.location.search).get('next') || '/main';
      router.replace(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your information.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="flex items-center gap-3 text-lg text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p>Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader className="text-center">
          <UserCheck className="mx-auto mb-2 h-10 w-10 text-primary" />
          <CardTitle className="text-3xl font-headline">Verify Information</CardTitle>
          <CardDescription>Just a couple details before you continue.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 border border-destructive bg-destructive/10 rounded-md text-destructive text-sm">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 mr-2 mt-0.5" />
                <div>{error}</div>
              </div>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input value={profile?.email ?? ''} readOnly aria-readonly="true" className="bg-muted/50 pointer-events-none" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">University</label>
                <Input value={profile?.university ?? ''} readOnly aria-readonly="true" className="bg-muted/50 pointer-events-none" />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField name="firstName" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl><Input {...field} placeholder="First name" autoComplete="given-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
                <FormField name="lastName" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl><Input {...field} placeholder="Last name" autoComplete="family-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField name="graduationYear" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Class of...</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select Graduation Year" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {validYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}/>
                <FormField name="gender" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                        <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}/>
              </div>

              {profile?.university === 'Boston College' && (
                <FormField name="campusArea" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Boston College Campus Area</FormLabel>
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select BC Campus Area" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="2k">2k</SelectItem>
                        <SelectItem value="Newton">Newton</SelectItem>
                        <SelectItem value="CoRo/Upper">CoRo/Upper (College Road/Upper)</SelectItem>
                        <SelectItem value="Lower">Lower</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}/>
              )}

              {SMS_ENABLED && (
              <div className="rounded-md border p-4 space-y-3 bg-muted/20">
                <FormField name="phoneNumber" control={form.control} render={({ field }) => {
                  const phoneValue = (field.value ?? '').trim();
                  // PhoneInput only ever emits "" or a valid "+1XXXXXXXXXX",
                  // so "has a usable phone" collapses to "value is non-empty".
                  const hasUsablePhone = PHONE_RE.test(phoneValue);
                  return (
                    <>
                      <FormItem>
                        <FormLabel>Phone number <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                        <FormControl>
                          <PhoneInput
                            value={field.value ?? ''}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                        </FormControl>
                        <FormDescription>
                          US numbers only. Only used to text you about new matches - never shared.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>

                      <FormField name="smsNotificationsEnabled" control={form.control} render={({ field: smsField }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              id="smsNotificationsEnabled"
                              disabled={!hasUsablePhone}
                              checked={hasUsablePhone && !!smsField.value}
                              onCheckedChange={(v) => smsField.onChange(Boolean(v) && hasUsablePhone)}
                            />
                          </FormControl>
                          <label
                            htmlFor="smsNotificationsEnabled"
                            className={`text-sm font-normal leading-snug ${hasUsablePhone ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}
                          >
                            Text me when I get matched. Standard messaging rates may apply.
                            {!hasUsablePhone && <span className="block text-[11px] mt-0.5">Add a phone number above to enable.</span>}
                          </label>
                        </FormItem>
                      )}/>
                    </>
                  );
                }}/>
              </div>
              )}

              {/*
                Keep submit enabled even while the form is invalid — that way a
                confused user who clicks Continue with missing fields gets the
                instead of a silently-disabled button with no feedback.
              */}
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <UserCheck className="mr-2 h-4 w-4" />
                    Continue
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
