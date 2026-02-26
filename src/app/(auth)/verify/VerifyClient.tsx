'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { applyActionCode } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react';

export default function VerifyClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oobCode = searchParams.get('oobCode');

  const [status, setStatus] = useState('idle'); // idle | verifying | success | error
  const [error, setError] = useState<string | null>(null);
  const [nextPath, setNextPath] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!oobCode) {
      setError('Invalid verification link. Please try again from your email.');
      setStatus('error');
      return;
    }

    setStatus('verifying');
    setError(null);

    try {
      await applyActionCode(auth, oobCode);

      // If the user is currently signed in on this browser, create SSR session cookie
      // so they can proceed without logging in again.
      const current = auth.currentUser;
      if (current) {
        await current.reload();
        if (current.emailVerified) {
          const idToken = await current.getIdToken(true);
          const res = await fetch('/api/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ idToken }),
          });
          if (res.ok) {
            setNextPath('/onboarding?next=' + encodeURIComponent('/main'));
          }
        }
      }

      setStatus('success');
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/invalid-action-code') {
        setError('This verification link is invalid or has expired. It might have already been used. Please request a new one.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <ShieldCheck className="h-12 w-12 text-green-500" />
          </div>
          <CardTitle className="text-3xl font-headline">Email Verified!</CardTitle>
          <CardDescription>
            Your email is confirmed.
            {nextPath ? ' Continue below to enter the app.' : ' You can now log in to get started.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          {nextPath ? (
            <Button onClick={() => router.replace(nextPath)}>Continue</Button>
          ) : (
            <Button onClick={() => router.replace('/login')}>Go to Log In</Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (status === 'error') {
    return (
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <AlertCircle className="h-12 w-12 text-red-500" />
          </div>
          <CardTitle className="text-3xl font-headline">Verification Failed</CardTitle>
          <CardDescription>{error || 'An error occurred.'}</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button onClick={() => router.push('/login')} variant="secondary">
            Back to Log In
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl font-headline">Verify Your Email</CardTitle>
        <CardDescription>Click the button below to complete your email verification.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleVerify} className="w-full" disabled={status === 'verifying'}>
          {status === 'verifying' ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</>
          ) : (
            'Verify Email'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
