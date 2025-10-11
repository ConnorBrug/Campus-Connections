
'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format, parse, startOfToday, addHours, isBefore, parseISO } from "date-fns";
import { Plane, Ticket, Clock, PlaneTakeoff, Backpack, Luggage, CalendarIcon, Users, Loader2, Info } from "lucide-react";
import { submitTripDetailsAction, type TripDetailsFormState } from "@/lib/actions";
import { useEffect, useState, useMemo, useActionState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";


const massachusettsAirports = [
  { name: "Boston Logan International", code: "BOS" },
  { name: "Worcester Regional", code: "ORH" },
  { name: "Nantucket Memorial", code: "ACK" },
  { name: "Martha's Vineyard", code: "MVY" },
  { name: "Cape Cod Gateway (Hyannis)", code: "HYA" },
  { name: "New Bedford Regional", code: "EWB" },
  { name: "Westfield-Barnes Regional", code: "BAF" },
];
const massachusettsAirportCodes = massachusettsAirports.map(a => a.code) as [string, ...string[]];

const tennesseeAirports = [
    { name: "Nashville International Airport", code: "BNA" },
    { name: "Memphis International Airport", code: "MEM" },
    { name: "McGhee Tyson Airport (Knoxville)", code: "TYS" },
    { name: "Chattanooga Metropolitan Airport", code: "CHA" },
    { name: "Tri-Cities Airport", code: "TRI" },
];
const tennesseeAirportCodes = tennesseeAirports.map(a => a.code) as [string, ...string[]];

const allAirportCodes = [...massachusettsAirportCodes, ...tennesseeAirportCodes] as [string, ...string[]];

const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
const minutes = ['00', '15', '30', '45'];
const periods = ['AM', 'PM'] as const;

const TripDetailsSchema = z.object({
  userId: z.string().min(1, "User ID is required."),
  university: z.string().min(1, "University is required."),
  flightCode: z.string().min(3, "Flight code required (e.g., UA234).").regex(/^[a-zA-Z0-9]+$/, "Alphanumeric only."),
  flightDate: z.date({
    required_error: "Flight date is required.",
    invalid_type_error: "That's not a valid date!",
  }),
  flightHour: z.string().min(1, "Hour is required."),
  flightMinute: z.string().min(1, "Minute is required."),
  flightPeriod: z.enum(periods, { required_error: "AM/PM is required." }),
  departingAirport: z.enum(allAirportCodes, {
    required_error: "Please select an airport.",
    invalid_type_error: "Invalid airport selected." 
  }),
  numberOfCarryons: z.coerce.number().min(0, "Cannot be negative.").max(2, "Max 2 carry-ons."),
  numberOfCheckedBags: z.coerce.number().min(0, "Cannot be negative.").max(3, "Max 3 checked bags."),
  preferredMatchGender: z.enum(['Male', 'Female', 'No preference'], { required_error: "Please select a preference." }),
  campusArea: z.string().optional(),
});

type TripDetailsFormValues = z.infer<typeof TripDetailsSchema>;

interface TripDetailsFormProps {
  userId?: string;
  userUniversity?: string;
  isTripPending?: boolean;
}


export function TripDetailsForm({ userId, userUniversity, isTripPending }: TripDetailsFormProps) {
  const { toast } = useToast();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [minCalendarDate, setMinCalendarDate] = useState<Date | undefined>(undefined);

  const initialState: TripDetailsFormState = { message: undefined, errors: undefined };
  const [state, dispatch] = useActionState(submitTripDetailsAction, initialState);
  
  const airports = userUniversity === 'Vanderbilt' ? tennesseeAirports : massachusettsAirports;
  const defaultAirport = userUniversity === 'Vanderbilt' ? 'BNA' : 'BOS';

  const carryOnOptions = [0, 1, 2];
  const checkedBagOptions = [0, 1, 2, 3];

  const form = useForm<TripDetailsFormValues>({
    resolver: zodResolver(TripDetailsSchema),
    defaultValues: {
      userId: userId || "",
      university: userUniversity || "",
      flightCode: "",
      flightDate: undefined,
      flightHour: '02',
      flightMinute: '30',
      flightPeriod: 'PM',
      departingAirport: defaultAirport,
      numberOfCarryons: 0, 
      numberOfCheckedBags: 0,
      preferredMatchGender: 'No preference',
    },
  });
  
  const watchedValues = form.watch();

  const isTimeInvalid = useMemo(() => {
    if (!watchedValues.flightDate || !watchedValues.flightHour || !watchedValues.flightMinute || !watchedValues.flightPeriod) {
      return false;
    }
    const flightTime = `${watchedValues.flightHour}:${watchedValues.flightMinute} ${watchedValues.flightPeriod}`;
    const flightDateTimeStr = `${format(watchedValues.flightDate, 'yyyy-MM-dd')} ${flightTime}`;
    const flightDateTime = parse(flightDateTimeStr, 'yyyy-MM-dd h:mm a', new Date());

    const threeHoursFromNow = addHours(new Date(), 3);
    return isBefore(flightDateTime, threeHoursFromNow);
  }, [watchedValues]);


  useEffect(() => {
    setIsClient(true);
    const today = startOfToday();
    setMinCalendarDate(today);

    if (form.getValues("flightDate") === undefined) {
        form.setValue("flightDate", today, { shouldValidate: true });
    }
  }, [form]);

  useEffect(() => {
    if (state?.errors) {
      if (state.errors.flightCode) form.setError("flightCode", { type: "server", message: state.errors.flightCode.join(', ') });
      if (state.errors.flightDate) form.setError("flightDate", { type: "server", message: state.errors.flightDate.join(', ') });
      if (state.errors.departingAirport) form.setError("departingAirport", { type: "server", message: state.errors.departingAirport.join(', ') });
      if (state.errors.numberOfCarryons) form.setError("numberOfCarryons", { type: "server", message: state.errors.numberOfCarryons.join(', ') });
      if (state.errors.numberOfCheckedBags) form.setError("numberOfCheckedBags", { type: "server", message: state.errors.numberOfCheckedBags.join(', ') });
      if (state.errors._form) toast({ title: "Submission Error", description: state.errors._form.join(', '), variant: "destructive" });
    }
  }, [state, form, toast]);


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
        <form action={dispatch} onSubmit={(evt) => {
            form.handleSubmit(() => {
              // Valid client-side, let the action proceed
            })(evt);
          }} className="space-y-6">
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
                        <Input placeholder="e.g., UA234" {...field} onChange={e => field.onChange(e.target.value.toUpperCase())} className="text-base md:text-sm"/>
                      </FormControl>
                      <FormDescription>
                        Your airline flight code (e.g., UA234, BA007).
                      </FormDescription>
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
                        <CalendarIcon className="h-4 w-4" /> Your flight's departure date
                      </FormLabel>
                      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value && isClient ? 
                                format(field.value, "PPP")
                              : (
                                <span>Pick a date</span>
                              )}
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
                                if(date) field.onChange(date); else field.onChange(undefined);
                                setIsCalendarOpen(false);
                              }}
                              disabled={(date) => {
                                  if (minCalendarDate) {
                                      return date < minCalendarDate;
                                  }
                                  return date < new Date(new Date().setHours(0,0,0,0));
                              }}
                              initialFocus={!field.value}
                              defaultMonth={field.value || minCalendarDate}
                            />
                          )}
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        We try our best to match our users 24 hours before their flight. We highly recommend you submit a request in advance to allow our algorithm to find you your best match
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
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
                                {hours.map(hour => <SelectItem key={`h-${hour}`} value={hour}>{hour}</SelectItem>)}
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
                                {minutes.map(min => <SelectItem key={`m-${min}`} value={min}>{min}</SelectItem>)}
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
                                {periods.map(p => <SelectItem key={`p-${p}`} value={p}>{p}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormDescription>The time your flight begins boarding.</FormDescription>
                </FormItem>

                <FormField
                  control={form.control}
                  name="departingAirport"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <PlaneTakeoff className="h-4 w-4" /> Departing Airport
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value} name={field.name}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an airport" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {airports.map(airport => (
                            <SelectItem key={airport.code} value={airport.code}>
                              {airport.name} ({airport.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>Select your departure airport from the list.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="numberOfCarryons"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <Backpack className="h-4 w-4" /> Carry-on Bags
                      </FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))} value={String(field.value)} name={field.name}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue>{field.value}</SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {carryOnOptions.map(num => (
                            <SelectItem key={`carryon-${num}`} value={String(num)}>
                              {num}
                            </SelectItem>
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
                      <Select onValueChange={(value) => field.onChange(parseInt(value))} value={String(field.value)} name={field.name}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue>{field.value}</SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {checkedBagOptions.map(num => (
                            <SelectItem key={`checked-${num}`} value={String(num)}>
                              {num}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                         <FormDescription className="text-xs">We will try our best to match you with your preference.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Input type="hidden" {...form.register("userId")} />
                  <Input type="hidden" {...form.register("university")} />
              </div>
            </fieldset>
            {isTimeInvalid && (
              <Alert variant="destructive" className="mt-4">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Trip requests must be for a flight at least 3 hours from now. Please select a later time or date.
                </AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full" disabled={isTripPending || form.formState.isSubmitting || !isClient || isTimeInvalid}>
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : isTripPending ? (
                "Trip is Pending"
              ) : (
                "Find Matches"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
