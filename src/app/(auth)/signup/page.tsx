'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signup, type SignupData } from "@/lib/auth";
import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { CarFront, AlertTriangle, Loader2, CheckCircle2, XCircle, CalendarIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField, FormItem, FormControl, FormMessage, Form, FormDescription, FormLabel } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, subYears } from "date-fns";

const SignupFormSchema = z.object({
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  email: z.string().email("Invalid email address.").refine(email => email.toLowerCase().endsWith('@bc.edu') || email.toLowerCase().endsWith('@vanderbilt.edu'), {
    message: "A valid university email (@bc.edu or @vanderbilt.edu) is required.",
  }),
  university: z.string().min(1, "Please select a university."),
  campusArea: z.string().optional(),
  gender: z.enum(['Male', 'Female', 'Other', 'Prefer not to say'], { required_error: "Please select your gender."}),
  dateOfBirth: z.date({
    required_error: "Your date of birth is required.",
  }).refine(date => date <= subYears(new Date(), 18), {
    message: "You must be at least 18 years old to sign up.",
  }),
  password: z.string()
    .min(8, "Password must be at least 8 characters long.")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter.")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
    .regex(/[0-9]/, "Password must contain at least one number."),
  confirmPassword: z.string(),
  agreeToTerms: z.boolean().refine(val => val === true, {
    message: "You must agree to the terms and conditions.",
  }),
})
.refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})
.refine(data => {
  if (data.university === "Boston College") {
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

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => { setIsClient(true); }, []);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(SignupFormSchema),
    mode: "onChange",
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      university: undefined,
      campusArea: undefined,
      gender: undefined,
      dateOfBirth: undefined,
      password: '',
      confirmPassword: '',
      agreeToTerms: false,
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [pageError, setPageError] = useState<React.ReactNode | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const watchedUniversity = form.watch('university');
  const watchedPassword = form.watch('password');
  const watchedEmail = form.watch('email');

  useEffect(() => {
    const lowerCaseEmail = watchedEmail.toLowerCase();
    if (lowerCaseEmail.endsWith('@bc.edu')) {
      form.setValue('university', 'Boston College', { shouldValidate: true });
    } else if (lowerCaseEmail.endsWith('@vanderbilt.edu')) {
      form.setValue('university', 'Vanderbilt', { shouldValidate: true });
    } else {
      if (form.getValues('university')) {
        form.setValue('university', '', { shouldValidate: true });
      }
    }
  }, [watchedEmail, form]);

  useEffect(() => {
    if (watchedUniversity !== 'Boston College') {
      form.setValue('campusArea', undefined);
    }
  }, [watchedUniversity, form]);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    form.setValue('email', e.target.value.toLowerCase(), { shouldValidate: true });
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

    const signupPayload: SignupData = {
      name: `${data.firstName} ${data.lastName}`.trim(),
      email: data.email,
      passwordInput: data.password,
      university: data.university,
      gender: data.gender,
      dateOfBirth: data.dateOfBirth.toISOString(),
      photoUrl: createInitialsSvg(initials),
      ...(data.university === "Boston College" && { campusArea: data.campusArea }),
    };

    try {
      const user = await signup(signupPayload);
      if (user) {
        toast({
          title: "Account Created!",
          description: "Welcome to Connections! You're ready to find a ride.",
          duration: 7000,
        });
        router.push(`/main`);
      }
    } catch (error: any) {
      let errorMessage: React.ReactNode = "An unexpected error occurred during signup.";
      if (error.code) {
        switch (error.code) {
          case 'auth/email-already-in-use':
            errorMessage = (
              <>
                An account with the email {data.email} already exists.{' '}
                <Link href="/login" className="font-bold text-primary hover:underline">
                  Go to Login
                </Link>
                .
              </>
            );
            break;
          case 'auth/weak-password':
            errorMessage = "The password is too weak. Please meet all the requirements.";
            break;
          case 'auth/invalid-email':
            errorMessage = "The email address is not valid.";
            break;
          case 'auth/operation-not-allowed':
            errorMessage = "Email/password accounts are not enabled. Please contact support.";
            break;
          case 'auth/configuration-not-found':
            errorMessage = "A configuration error occurred. Please refresh the page and try again.";
            break;
          default:
            errorMessage = `Firebase Error: ${error.message}`;
        }
      }
      setPageError(errorMessage);
      setIsLoading(false);
    }
  };

  const passwordRequirements = useMemo(() => {
    const pass = watchedPassword || '';
    return [
      { label: "At least 8 characters", meets: pass.length >= 8 },
      { label: "Contains a lowercase letter", meets: /[a-z]/.test(pass) },
      { label: "Contains an uppercase letter", meets: /[A-Z]/.test(pass) },
      { label: "Contains a number", meets: /[0-9]/.test(pass) }
    ];
  }, [watchedPassword]);

  // ---------- UI (let layout handle centering + height) ----------

  if (isLoading) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-10">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-2 text-muted-foreground">Creating your account...</p>
      </div>
    );
  }

  return (
    <Card className="w-full max-w-lg mx-auto shadow-xl">
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
        {/* the Form JSX you already have remains unchanged */}
        {/* ... */}
      </CardContent>
      <CardFooter className="flex flex-col items-center pt-2">
        <p className="text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}