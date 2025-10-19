
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { login } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CarFront, LogIn, AlertTriangle, Loader2 } from 'lucide-react';

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
      const { user } = await login(email, password);
      
      if (!user.emailVerified) {
        router.replace('/verify-email');
      } else {
        router.replace('/main');
      }
      // On success, we don't set isSubmitting to false,
      // because we want the loading indicator to show until the redirect is complete.
    } catch (error: any) {
      if (error.code) {
        switch (error.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            setPageError('Invalid email or password.');
            break;
          case 'auth/too-many-requests':
            setPageError('Too many login attempts. Please try again later.');
            break;
          case 'auth/invalid-email':
            setPageError('Please enter a valid email address.');
            break;
          default:
            setPageError(error.message || 'An unexpected error occurred during login.');
        }
      } else {
        setPageError(error?.message || 'Login failed. Please check your credentials.');
      }
      setIsSubmitting(false); // Only set to false on error
    }
  };

  // The loading indicator is now the default state when submitting,
  // preventing the form from reappearing.
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
              disabled={isSubmitting}
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
              disabled={isSubmitting}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            Login
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
