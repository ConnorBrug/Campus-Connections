'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginWithGoogle } from "@/lib/auth";
import { useState, type SVGProps } from "react";
import { CarFront, AlertTriangle, Loader2 } from "lucide-react";
import { profileIsIncomplete } from '@/lib/types';

function GoogleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M12 11.999h10.5c.1.6.1 1.2.1 1.8 0 6.2-4.2 10.6-10.6 10.6A10.9 10.9 0 0 1 1 13.8c0-6 4.7-10.8 10.7-10.8 2.9 0 5.3 1.1 7 2.9l-3 3c-.8-.8-2-1.7-4-1.7-3.4 0-6.2 2.8-6.2 6.3s2.8 6.3 6.2 6.3c3.9 0 5.4-2.6 5.6-4H12v-4.4z" fill="currentColor"/>
    </svg>
  );
}

export default function SignupClient() {
  const router = useRouter();
  // Inline-only OAuth spinner - never lock the whole page, since Firebase's
  // popup-closed detection can take up to a minute to fire if the user X's
  // the Google window mid-flow.
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [pageError, setPageError] = useState<React.ReactNode | null>(null);

  const handleGoogle = async () => {
    if (isGoogleSubmitting) return;
    setIsGoogleSubmitting(true);
    setPageError(null);
    try {
      const { profile, isNew } = await loginWithGoogle();
      // New users always go through onboarding (to capture grad year, gender,
      // optional phone, BC campus area). Existing users with incomplete
      // profiles also get redirected.
      if (isNew || profileIsIncomplete(profile)) {
        router.replace('/onboarding?next=' + encodeURIComponent('/main'));
      } else {
        router.replace('/main');
      }
    } catch (e) {
      const code = (e as { code?: string })?.code;
      // Silently ignore user-initiated popup cancellations - no error banner needed.
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setIsGoogleSubmitting(false);
        return;
      }
      setPageError(e instanceof Error ? e.message : 'Google sign-up failed.');
      setIsGoogleSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto shadow-xl my-8">
      <CardHeader className="text-center">
        <div className="mb-4 flex justify-center">
          <CarFront className="h-12 w-12 text-primary" />
        </div>
        <CardTitle className="text-3xl font-headline">Create Your Account</CardTitle>
        <CardDescription>
          Sign up with your school email to find your ride.
        </CardDescription>
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

        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="w-full h-11"
            onClick={handleGoogle}
            disabled={isGoogleSubmitting}
            aria-busy={isGoogleSubmitting}
          >
            {isGoogleSubmitting ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <GoogleIcon className="mr-2 h-5 w-5" />
            )}
            {isGoogleSubmitting ? 'Opening Google...' : 'Continue with Google'}
          </Button>
        </div>

        <div className="mt-6 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Why only school accounts?</p>
          <p>
            We restrict sign-ups to verified university emails (e.g. @bc.edu, @vanderbilt.edu).
            Your school is detected automatically from your email - no manual verification needed.
          </p>
        </div>

        <p className="mt-4 text-[11px] text-muted-foreground text-center leading-relaxed">
          By continuing you agree to our{' '}
          <Link href="/terms-of-service" className="underline hover:text-primary" target="_blank">Terms of Service</Link>
          {' '}&{' '}
          <Link href="/privacy-policy" className="underline hover:text-primary" target="_blank">Privacy Policy</Link>.
        </p>
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
