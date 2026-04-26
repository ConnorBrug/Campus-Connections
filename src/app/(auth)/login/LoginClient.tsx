'use client';

import { useState, type SVGProps } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { loginWithGoogle } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CarFront, AlertTriangle, Loader2, Info } from 'lucide-react';
import { profileIsIncomplete } from '@/lib/types';

function GoogleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M12 11.999h10.5c.1.6.1 1.2.1 1.8 0 6.2-4.2 10.6-10.6 10.6A10.9 10.9 0 0 1 1 13.8c0-6 4.7-10.8 10.7-10.8 2.9 0 5.3 1.1 7 2.9l-3 3c-.8-.8-2-1.7-4-1.7-3.4 0-6.2 2.8-6.2 6.3s2.8 6.3 6.2 6.3c3.9 0 5.4-2.6 5.6-4H12v-4.4z" fill="currentColor"/>
    </svg>
  );
}

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // OAuth spinner is inline (no full-page lock) because the user might close
  // the Google popup mid-flow — Firebase's popup-closed detection can take up
  // to ~60s, and we don't want the page frozen behind a loader during that.
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  // Post-deletion acknowledgment: the account-delete API redirects here with
  // ?deleted=true. Show a neutral banner so the user knows the deletion
  // actually happened (otherwise it looks like they were just logged out).
  // Dismiss-on-interaction: any subsequent state change hides it implicitly
  // because the URL no longer drives rendering after router.replace.
  const [deletedDismissed, setDeletedDismissed] = useState(false);
  const showDeletedBanner =
    !deletedDismissed && searchParams?.get('deleted') === 'true';

  const handleGoogle = async () => {
    if (isGoogleSubmitting) return;
    setDeletedDismissed(true);
    setIsGoogleSubmitting(true);
    setPageError(null);
    try {
      const { profile } = await loginWithGoogle(); // session cookie minted
      if (profileIsIncomplete(profile)) {
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
      setPageError(e instanceof Error ? e.message : 'Google sign-in failed.');
      setIsGoogleSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto shadow-xl">
      <CardHeader className="text-center">
        <div className="mb-4 flex justify-center">
          <CarFront className="h-12 w-12 text-primary" />
        </div>
        <CardTitle className="text-3xl font-headline">Welcome Back!</CardTitle>
        <CardDescription>Log in to find your ride.</CardDescription>
      </CardHeader>
      <CardContent>
        {showDeletedBanner && (
          <Alert className="mb-4" role="status">
            <Info className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Your account has been deleted.</AlertTitle>
            <AlertDescription>
              Thanks for trying Campus Connections. If you ever want to come back,
              just sign in again and we&apos;ll set you up fresh.
            </AlertDescription>
          </Alert>
        )}

        {pageError && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Login Failed</AlertTitle>
            <AlertDescription>{pageError}</AlertDescription>
          </Alert>
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
              <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              <GoogleIcon className="mr-2 h-5 w-5" />
            )}
            {isGoogleSubmitting ? 'Opening Google...' : 'Continue with Google'}
          </Button>
        </div>

        <div className="mt-6 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">School accounts only</p>
          <p>
            Sign in with your university Google account (e.g. @bc.edu, @vanderbilt.edu).
            Your school is detected automatically from your email - no manual verification needed.
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-center pt-4">
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="font-medium text-foreground underline underline-offset-2 hover:text-foreground/70" prefetch={false}>
            Sign up
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
