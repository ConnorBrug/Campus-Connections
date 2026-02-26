'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signup, type SignupData, loginWithGoogle } from "@/lib/auth";
import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { CarFront, AlertTriangle, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField, FormItem, FormControl, FormMessage, Form, FormLabel } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M12 11.999h10.5c.1.6.1 1.2.1 1.8 0 6.2-4.2 10.6-10.6 10.6A10.9 10.9 0 0 1 1 13.8c0-6 4.7-10.8 10.7-10.8 2.9 0 5.3 1.1 7 2.9l-3 3c-.8-.8-2-1.7-4-1.7-3.4 0-6.2 2.8-6.2 6.3s2.8 6.3 6.2 6.3c3.9 0 5.4-2.6 5.6-4H12v-4.4z" fill="currentColor"/>
    </svg>
  );
}

const currentYear = new Date().getFullYear();
const validYears = [currentYear + 1, currentYear + 2, currentYear + 3, currentYear + 4].map(String);

const SignupFormSchema = z.object({
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  email: z.string().email("Invalid email address.")
    .refine(email => {
      const lower = email.toLowerCase();
      const isValidUniversity = lower.endsWith('@bc.edu') || lower.endsWith('@vanderbilt.edu');
      if (process.env.NODE_ENV === 'development') {
        return isValidUniversity || lower.endsWith('@gmail.com');
      }
      return isValidUniversity;
    }, {
      message: process.env.NODE_ENV === 'development'
        ? "A valid university email (@bc.edu, @vanderbilt.edu, or @gmail.com for dev) is required."
        : "A valid university email (@bc.edu or @vanderbilt.edu) is required.",
    }),
  campusArea: z.string().optional(),
  gender: z.enum(['Male', 'Female', 'Other', 'Prefer not to say'], { required_error: "Please select your gender."}),
  graduationYear: z.string({ required_error: "Please select your graduation year." })
    .refine(val => validYears.includes(val), { message: "Please select a valid graduation year."}),
  password: z.string()
    .min(8, "Password must be at least 8 characters long.")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter.")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
    .regex(/[0-9]/, "Password must contain at least one number."),
  confirmPassword: z.string(),
  agreeToTerms: z.boolean().refine(val => val === true, {
    message: "You must agree to the terms and conditions.",
  }),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
}).refine(data => {
  const lower = (data.email || '').toLowerCase();
  if (lower.endsWith('@bc.edu')) {
    return !!data.campusArea && data.campusArea.length > 0;
  }
  return true;
}, {
  message: "Please select a campus area for Boston College.",
  path: ["campusArea"],
});

type SignupFormValues = z.infer<typeof SignupFormSchema>;

function PasswordRequirement({ meets, label }: { meets: boolean; label: string }) {
  return (
    <div className={cn("flex items-center text-sm", meets ? "text-green-600" : "text-muted-foreground")}>
      {meets ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <XCircle className="mr-2 h-4 w-4" />}
      {label}
    </div>
  );
}

import { profileIsIncomplete } from '@/lib/types';

export default function SignupClient() {
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(SignupFormSchema),
    mode: "onChange",
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      campusArea: undefined,
      gender: undefined,
      graduationYear: undefined,
      password: '',
      confirmPassword: '',
      agreeToTerms: false,
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [pageError, setPageError] = useState<React.ReactNode | null>(null);

  const watchedPassword = form.watch('password');
  const watchedEmail = form.watch('email');

  const derivedUniversity = useMemo(() => {
    const lower = (watchedEmail || '').toLowerCase();
    if (lower.endsWith('@bc.edu')) return 'Boston College';
    if (lower.endsWith('@vanderbilt.edu')) return 'Vanderbilt';
    if (process.env.NODE_ENV === 'development' && lower.endsWith('@gmail.com')) return 'CollegeU';
    return null;
  }, [watchedEmail]);

  useEffect(() => {
    if (derivedUniversity !== 'Boston College') {
      form.setValue('campusArea', undefined, { shouldValidate: true });
    }
  }, [derivedUniversity, form]);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    form.setValue('email', (e.target.value || '').toLowerCase(), { shouldValidate: true });
    if (pageError) setPageError(null);
  };

  const createInitialsSvg = (initials: string) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="#e2e8f0"></rect><text x="50" y="50" font-family="Arial" font-size="40" fill="#475569" text-anchor="middle" dy=".3em">${initials}</text></svg>`;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  };

  const onSubmit = async (data: SignupFormValues) => {
    setPageError(null);
    setIsLoading(true);

    const firstInitial = data.firstName ? data.firstName.charAt(0) : '';
    const lastInitial = data.lastName ? data.lastName.charAt(0) : '';
    const initials = `${firstInitial}${lastInitial}`.toUpperCase();

    const uni = derivedUniversity!;

    const signupPayload: SignupData = {
      name: `${data.firstName} ${data.lastName}`.trim(),
      email: data.email,
      passwordInput: data.password,
      university: uni,
      gender: data.gender,
      graduationYear: parseInt(data.graduationYear, 10),
      photoUrl: createInitialsSvg(initials),
      ...(uni === 'Boston College' && { campusArea: data.campusArea }),
    };

    try {
      await signup(signupPayload);
      toast({
        title: "Account Created!",
        description: "A verification email has been sent. Please check your inbox.",
        duration: 7000,
      });
      router.replace('/verify-email');
    } catch (error) {
      let errorMessage: React.ReactNode = "An unexpected error occurred during signup.";
      const code = (error as { code?: string })?.code;
      if (code) {
        switch (code) {
          case 'auth/email-already-in-use':
            errorMessage = (
              <>
                An account with the email {data.email} already exists.{" "}
                <Link href="/login" className="font-bold text-primary hover:underline" prefetch={false}>
                  Go to Log In
                </Link>.
              </>
            );
            break;
          default:
            errorMessage = `Firebase Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      }
      setPageError(errorMessage);
      setIsLoading(false);
    }
  };

  const passwordRequirements = useMemo(() => {
    const p = form.getValues('password') || '';
    return [
      { label: "At least 8 characters", meets: p.length >= 8 },
      { label: "Contains a lowercase letter", meets: /[a-z]/.test(p) },
      { label: "Contains an uppercase letter", meets: /[A-Z]/.test(p) },
      { label: "Contains a number", meets: /[0-9]/.test(p) }
    ];
  }, [watchedPassword, form]);

  const handleGoogleSignup = async () => {
    setIsLoading(true);
    setPageError(null);
    try {
      const { profile } = await loginWithGoogle();
      if (profileIsIncomplete(profile)) {
        router.replace('/onboarding?next=' + encodeURIComponent('/main'));
      } else {
        router.replace('/main');
      }
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "Google sign-up failed.");
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-10">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-2 text-muted-foreground">Creating your account...</p>
      </div>
    );
  }

  return (
    <Card className="w-full max-w-lg mx-auto shadow-xl my-8">
      <CardHeader className="text-center">
        <div className="mb-4 flex justify-center">
          <CarFront className="h-12 w-12 text-primary" />
        </div>
        <CardTitle className="text-3xl font-headline">Create Your Account</CardTitle>
        <CardDescription>Join Connections to find your ride.</CardDescription>
      </CardHeader>
      <CardContent>
        {pageError && (
          <div className="mb-4 p-3 border border-destructive bg-destructive/10 rounded-md text-destructive text-sm">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-semibold">Signup Error</span>
                <p>{pageError}</p>
              </div>
            </div>
          </div>
        )}

        <Button type="button" variant="outline" className="w-full mb-4" onClick={handleGoogleSignup}>
          <GoogleIcon className="mr-2 h-4 w-4" />
          Continue with Google
        </Button>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        {/* form content unchanged */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="firstName" render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl><Input placeholder="First Name" {...field} autoComplete="given-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="lastName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl><Input placeholder="Last Name" {...field} autoComplete="family-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}/>
            </div>

            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>University Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="your.name@university.edu"
                    {...field}
                    onChange={(e) => { field.onChange(e); handleEmailChange(e as unknown as React.ChangeEvent<HTMLInputElement>); }}
                    autoComplete="email"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}/>

            <div className="rounded-md border p-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">University</p>
                  <p className="text-sm text-muted-foreground">
                    {derivedUniversity ? <>We&apos;ll set your university to <span className="font-medium">{derivedUniversity}</span>.</> : <>Enter a valid university email to auto-detect.</>}
                  </p>
                </div>
                <Input value={derivedUniversity ?? ''} readOnly aria-readonly="true" placeholder="Auto-detected" className="w-44 bg-muted/40 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {derivedUniversity === 'Boston College' && (
              <FormField control={form.control} name="campusArea" render={({ field }) => (
                <FormItem>
                  <FormLabel>Boston College Campus Area</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ''} name="campusArea">
                    <FormControl><SelectTrigger id="campusArea"><SelectValue placeholder="Select BC Campus Area" /></SelectTrigger></FormControl>
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="graduationYear" render={({ field }) => (
                <FormItem>
                  <FormLabel>Class of...</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} name="graduationYear">
                    <FormControl><SelectTrigger><SelectValue placeholder="Select Graduation Year" /></SelectTrigger></FormControl>
                    <SelectContent>{validYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="gender" render={({ field }) => (
                <FormItem>
                  <FormLabel>Gender</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} name="gender">
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl><Input type="password" placeholder="••••••••" {...field} autoComplete="new-password" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl><Input type="password" placeholder="••••••••" {...field} autoComplete="new-password" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}/>
            </div>

            <div className="space-y-1 rounded-md border p-3 shadow-sm">
              {passwordRequirements.map((req, i) => <PasswordRequirement key={i} meets={req.meets} label={req.label} />)}
            </div>

            <FormField control={form.control} name="agreeToTerms" render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                <FormControl><Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(Boolean(v))} id="agreeToTerms" /></FormControl>
                <div className="space-y-1 leading-none">
                  <Label htmlFor="agreeToTerms" className="text-sm font-normal text-muted-foreground">
                    I agree to the Connections{' '}
                    <Link href="/terms-of-service" className="underline hover:text-primary" target="_blank">Terms of Service</Link>
                    {' '}&{' '}
                    <Link href="/privacy-policy" className="underline hover:text-primary" target="_blank">Privacy Policy</Link>.
                  </Label>
                  <FormMessage />
                </div>
              </FormItem>
            )}/>

            <Button type="submit" className="w-full" disabled={!form.formState.isValid || isLoading}>
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing Up...</> : "Sign Up"}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex flex-col items-center pt-2">
        <p className="text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline" prefetch={false}>
            Log in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
