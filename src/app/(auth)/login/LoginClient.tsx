'use client';

import { useState, type SVGProps } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { login, loginWithGoogle, loginWithMicrosoft } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CarFront, LogIn, AlertTriangle, Loader2 } from 'lucide-react';

function GoogleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M12 11.999h10.5c.1.6.1 1.2.1 1.8 0 6.2-4.2 10.6-10.6 10.6A10.9 10.9 0 0 1 1 13.8c0-6 4.7-10.8 10.7-10.8 2.9 0 5.3 1.1 7 2.9l-3 3c-.8-.8-2-1.7-4-1.7-3.4 0-6.2 2.8-6.2 6.3s2.8 6.3 6.2 6.3c3.9 0 5.4-2.6 5.6-4H12v-4.4z" fill="currentColor"/>
    </svg>
  );
}

function MicrosoftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 23 23" aria-hidden="true" {...props}>
      <rect x="1"  y="1"  width="10" height="10" fill="#F25022" />
      <rect x="12" y="1"  width="10" height="10" fill="#7FBA00" />
      <rect x="1"  y="12" width="10" height="10" fill="#00A4EF" />
      <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}

import { profileIsIncomplete } from '@/lib/types';

export default function LoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setPageError(null);
    try {
      const { user, profile } = await login(email, password);
      if (!user.emailVerified) {
        router.replace('/verify-email');
        return;
      }
      if (profileIsIncomplete(profile)) {
        router.replace('/onboarding?next=' + encodeURIComponent('/main'));
        return;
      }
      router.replace('/main');
    } catch (error) {
      const code = (error as { code?: string })?.code;
      const message = error instanceof Error ? error.message : 'Login failed. Please check your credentials.';
      if (code) {
        switch (code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            setPageError('Invalid email or password. If you originally signed up with Google, please use the "Continue with Google" button above.');
            break;
          case 'auth/too-many-requests':
            setPageError('Too many login attempts. Please try again later.');
            break;
          case 'auth/invalid-email':
            setPageError('Please enter a valid email address.');
            break;
          default:
            setPageError(message);
        }
      } else {
        setPageError(message);
      }
      setIsSubmitting(false);
    }
  };

  const handleOAuth = async (providerLabel: 'Google' | 'Microsoft') => {
    setIsSubmitting(true);
    setPageError(null);
    try {
      const fn = providerLabel === 'Google' ? loginWithGoogle : loginWithMicrosoft;
      const { profile } = await fn(); // session cookie minted
      if (profileIsIncomplete(profile)) {
        router.replace('/onboarding?next=' + encodeURIComponent('/main'));
      } else {
        router.replace('/main');
      }
    } catch (e) {
      setPageError(e instanceof Error ? e.message : `${providerLabel} sign-in failed.`);
      setIsSubmitting(false);
    }
  };

  if (isSubmitting) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-10">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-2 text-muted-foreground">Logging you in...</p>
      </div>
    );
  }

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
        {pageError && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Login Failed</AlertTitle>
            <AlertDescription>{pageError}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2 mb-4">
          <Button type="button" variant="outline" className="w-full" onClick={() => handleOAuth('Google')}>
            <GoogleIcon className="mr-2 h-4 w-4" />
            Continue with Google
          </Button>
          <Button type="button" variant="outline" className="w-full" onClick={() => handleOAuth('Microsoft')}>
            <MicrosoftIcon className="mr-2 h-4 w-4" />
            Continue with Microsoft
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center mb-4">
          Use your school email (e.g. @bc.edu, @vanderbilt.edu) to sign in.
        </p>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or password</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate autoComplete="on">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="Password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full">
            Log In
            <LogIn className="ml-2 h-4 w-4" />
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col items-center pt-4">
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="font-medium text-primary hover:underline" prefetch={false}>
            Sign up
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
