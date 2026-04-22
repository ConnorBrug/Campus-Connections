'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useEffect, useState, startTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { format, parse, startOfToday, addHours, addMinutes } from 'date-fns';
import {
  Plane, Ticket, Clock, PlaneTakeoff, Backpack, Luggage, Calendar as CalendarIcon, Users, Loader2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Hard-code airport codes so z.enum gets a tuple type
const AIRPORT_CODES = [
  'BOS','ORH','ACK','MVY','HYA','EWB','BAF',
  'BNA','MEM','TYS','CHA','TRI',
] as const;
type AirportCode = typeof AIRPORT_CODES[number];

const massachusettsAirports = [
  { name: 'Boston Logan International', code: 'BOS' },
  { name: 'Worcester Regional', code: 'ORH' },
  { name: 'Nantucket Memorial', code: 'ACK' },
  { name: "Martha's Vineyard", code: 'MVY' },
  { name: 'Cape Cod Gateway (Hyannis)', code: 'HYA' },
  { name: 'New Bedford Regional', code: 'EWB' },
  { name: 'Westfield-Barnes Regional', code: 'BAF' },
] as const;

const tennesseeAirports = [
  { name: 'Nashville International Airport', code: 'BNA' },
  { name: 'Memphis International Airport', code: 'MEM' },
  { name: 'McGhee Tyson Airport (Knoxville)', code: 'TYS' },
  { name: 'Chattanooga Metropolitan Airport', code: 'CHA' },
  { name: 'Tri-Cities Airport', code: 'TRI' },
] as const;

const periods = ['AM', 'PM'] as const;
const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
const minutes = ['00', '15', '30', '45'] as const;

const TripDetailsSchema = z
  .object({
    userId: z.string().min(1, 'User ID is required.'),
    university: z.string().min(1, 'University is required.'),
    flightCode: z.string().min(3, 'Flight code required.').regex(/^[a-zA-Z0-9]+$/, 'Alphanumeric only.'),
    flightDate: z.date({ required_error: 'Pick a departure date.' }),
    flightHour: z.string().min(1, 'Pick an hour.'),
    flightMinute: z.string().min(1, 'Pick minutes.'),
    flightPeriod: z.enum(periods),
    departingAirport: z.enum(AIRPORT_CODES),
    numberOfCarryons: z.coerce.number().min(0).max(2),
    numberOfCheckedBags: z.coerce.number().min(0).max(3),
    preferredMatchGender: z.enum(['Male', 'Female', 'No preference']),
    campusArea: z.string().optional(),
  })
  // Reject flights less than 3h from now at validation time. The error is
  // attached to flightHour so it renders inline under the time picker
  // (instead of the old full-width red banner).
  .superRefine((v, ctx) => {
    if (!v.flightDate || !v.flightHour || !v.flightMinute || !v.flightPeriod) return;
    const dtStr = `${format(v.flightDate, 'yyyy-MM-dd')} ${v.flightHour}:${v.flightMinute} ${v.flightPeriod}`;
    const dt = parse(dtStr, 'yyyy-MM-dd h:mm a', new Date());
    if (dt.getTime() < addHours(new Date(), 3).getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['flightHour'],
        message: 'Flight must be at least 3 hours from now.',
      });
    }
  });
type TripDetailsFormValues = z.infer<typeof TripDetailsSchema>;

interface TripDetailsFormProps {
  userId?: string;
  userUniversity?: string;
  isTripPending?: boolean;
}

export function TripDetailsForm({ userId, userUniversity, isTripPending }: TripDetailsFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [minCalendarDate, setMinCalendarDate] = useState<Date>();

  const airports = userUniversity === 'Vanderbilt' ? tennesseeAirports : massachusettsAirports;
  const defaultAirport: AirportCode = userUniversity === 'Vanderbilt' ? 'BNA' : 'BOS';

  // Smallest valid time: now + 3h, rounded up to the next 15-min slot. We seed
  // the date/time fields with this so the form is submittable immediately and
  // users don't see a "pick a later time" warning on first render.
  function computeMinDepartureParts() {
    let dt = addHours(new Date(), 3);
    const mins = dt.getMinutes();
    const rounded = Math.ceil(mins / 15) * 15;
    dt = addMinutes(dt, rounded - mins);
    if (rounded === 60) {
      // Math.ceil(60/15)*15 === 60 can happen; normalise by letting date-fns
      // roll the hour over via addMinutes above (mins became 60 → hour+1, m=0).
    }
    const hour24 = dt.getHours();
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    return {
      date: new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()),
      hour: String(hour12).padStart(2, '0'),
      minute: String(dt.getMinutes()).padStart(2, '0'),
      period: hour24 >= 12 ? ('PM' as const) : ('AM' as const),
    };
  }

  const initialParts = computeMinDepartureParts();

  const form = useForm<TripDetailsFormValues>({
    resolver: zodResolver(TripDetailsSchema),
    // onTouched = validation fires after a field loses focus (or on submit).
    // Nothing is red on first render, but once a user tabs away from an empty
    // field it highlights, and a failed submit paints every missing field red
    // with inline messages so they always know what's blocking.
    mode: 'onTouched',
    defaultValues: {
      userId: userId ?? '',
      university: userUniversity ?? '',
      flightCode: '',
      flightDate: initialParts.date,
      flightHour: initialParts.hour,
      flightMinute: initialParts.minute,
      flightPeriod: initialParts.period,
      departingAirport: defaultAirport,
      numberOfCarryons: 0,
      numberOfCheckedBags: 0,
      preferredMatchGender: 'No preference',
    },
  });

  useEffect(() => {
    setIsClient(true);
    setMinCalendarDate(startOfToday());
  }, []);

  async function onSubmit(values: TripDetailsFormValues) {
    const timeStr = `${values.flightHour}:${values.flightMinute} ${values.flightPeriod}`;
    const dtStr = `${format(values.flightDate, 'yyyy-MM-dd')} ${timeStr}`;
    const dt = parse(dtStr, 'yyyy-MM-dd h:mm a', new Date());

    startTransition(async () => {
      try {
        const res = await fetch('/api/trips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include', // IMPORTANT so the __session cookie is sent
          body: JSON.stringify({
            flightCode: values.flightCode.toUpperCase(),
            flightDateTime: dt.toISOString(),
            departingAirport: values.departingAirport,
            numberOfCarryons: values.numberOfCarryons,
            numberOfCheckedBags: values.numberOfCheckedBags,
            preferredMatchGender: values.preferredMatchGender,
            campusArea: values.campusArea ?? null,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || 'Failed to submit trip.');
        toast({ title: 'Trip submitted', description: 'We are looking for a match!' });
        router.push('/trip-submitted');
      } catch (e) {
        toast({ title: 'Submission Error', description: e instanceof Error ? e.message : 'Please try again.', variant: 'destructive' });
      }
    });
  }

  const carryOnOptions = [0, 1, 2];
  const checkedBagOptions = [0, 1, 2, 3];

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Plane className="h-6 w-6 text-primary" />
          Find Your Ride
        </CardTitle>
        <CardDescription>Enter your flight and bag details to find matches.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <fieldset disabled={isTripPending || form.formState.isSubmitting}>
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="flightCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <Ticket className="h-4 w-4" /> Flight Code
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., UA234"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                          className="text-base md:text-sm"
                        />
                      </FormControl>
                      <FormDescription>Your airline flight code (e.g., UA234, BA007).</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="flightDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="flex items-center gap-1">
                        <CalendarIcon className="h-4 w-4" /> Departure date
                      </FormLabel>
                      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}
                            >
                              {field.value && isClient ? format(field.value, 'PPP') : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          {isClient && (
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={(date) => {
                                field.onChange(date ?? undefined);
                                setIsCalendarOpen(false);
                              }}
                              disabled={(date) => {
                                const min = minCalendarDate ?? startOfToday();
                                return date < min;
                              }}
                              initialFocus={!field.value}
                              defaultMonth={field.value || minCalendarDate}
                            />
                          )}
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        We usually match users ~24 hours before a flight. Submitting early helps find a better match.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Time */}
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    <Clock className="h-4 w-4" /> Flight Boarding Time
                  </FormLabel>
                  <div className="grid grid-cols-3 gap-1">
                    <FormField
                      control={form.control}
                      name="flightHour"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger>
                                <SelectValue placeholder="Hour" />
                              </SelectTrigger>
                              <SelectContent>
                                {hours.map((h) => (
                                  <SelectItem key={`h-${h}`} value={h}>{h}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="flightMinute"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger>
                                <SelectValue placeholder="Minute" />
                              </SelectTrigger>
                              <SelectContent>
                                {minutes.map((m) => (
                                  <SelectItem key={`m-${m}`} value={m}>{m}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="flightPeriod"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger>
                                <SelectValue placeholder="AM/PM" />
                              </SelectTrigger>
                              <SelectContent>
                                {periods.map((p) => (
                                  <SelectItem key={`p-${p}`} value={p}>{p}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormDescription>
                    The time your flight begins boarding. Must be at least 3 hours from now.
                  </FormDescription>
                </FormItem>

                {/* Airport */}
                <FormField
                  control={form.control}
                  name="departingAirport"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <PlaneTakeoff className="h-4 w-4" /> Departing Airport
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} name={field.name}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an airport" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {airports.map((a) => (
                            <SelectItem key={a.code} value={a.code}>
                              {a.name} ({a.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>Select your departure airport.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Bags */}
                <FormField
                  control={form.control}
                  name="numberOfCarryons"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <Backpack className="h-4 w-4" /> Carry-on Bags
                      </FormLabel>
                      <Select onValueChange={(v) => field.onChange(parseInt(v))} value={String(field.value)} name={field.name}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue>{field.value}</SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {carryOnOptions.map((n) => (
                            <SelectItem key={`carry-${n}`} value={String(n)}>{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="numberOfCheckedBags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <Luggage className="h-4 w-4" /> Checked Bags
                      </FormLabel>
                      <Select onValueChange={(v) => field.onChange(parseInt(v))} value={String(field.value)} name={field.name}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue>{field.value}</SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {[0,1,2,3].map((n) => (
                            <SelectItem key={`checked-${n}`} value={String(n)}>{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Preference */}
                <FormField
                  control={form.control}
                  name="preferredMatchGender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <Users className="h-4 w-4" /> Match Preference
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} name={field.name}>
                        <FormControl>
                          <SelectTrigger id="preferredMatchGender">
                            <SelectValue placeholder="Select preference" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="No preference">No preference</SelectItem>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-xs">We’ll try to match your preference.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Hidden user fields */}
                <Input type="hidden" {...form.register('userId')} />
                <Input type="hidden" {...form.register('university')} />
              </div>
            </fieldset>

            <Button
              type="submit"
              className="w-full"
              disabled={isTripPending || form.formState.isSubmitting || !isClient}
            >
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : isTripPending ? (
                'Trip is Pending'
              ) : (
                'Find Matches'
              )}
            </Button>
          </form>
   </Form>
      </CardContent>
    </Card>
  );
}
