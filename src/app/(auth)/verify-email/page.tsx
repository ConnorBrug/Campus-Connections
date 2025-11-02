'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import { sendVerificationEmailAgain } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MailCheck, Send, Loader2, AlertCircle } from 'lucide-react';
import { onAuthStateChanged, type User } from 'firebase/auth';

export default function VerifyEmailPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.replace('/login');
        return;
      }
      await currentUser.reload();
      setUser(currentUser);
      setIsLoading(false);
    });
    return () => unsub();
  }, [router]);

  const handleResend = async () => {
    if (!user) return;
    setIsSending(true);
    setMessage(null);
    setError(null);
    try {
      await sendVerificationEmailAgain();
      // on resend success
      setMessage('A new verification email has been sent. Check your Junk folder!');
    } catch (err: any) {
      if (err?.code === 'auth/too-many-requests') {
        setError('Too many requests. Please wait a few minutes before trying again.');
      } else {
        setError('Failed to send verification email. Please try again.');
      }
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center bg-background p-4 py-20">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-2 text-muted-foreground">Checking verification status...</p>
      </div>
    );
  }

  return (
    <div className="flex justify-center bg-background p-4 py-20">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <MailCheck className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-3xl font-headline">Verify Your Email</CardTitle>
          <CardDescription>
            A verification link was sent to <strong>{user?.email}</strong>. Please check your inbox and click the link to verify your email address.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
        {message && (
          <Alert>
            <AlertTitle>Success!</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

          <Button onClick={handleResend} className="w-full" disabled={isSending}>
            {isSending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>)
                       : (<><Send className="mr-2 h-4 w-4" /> Resend Verification Email</>)}
          </Button>

        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-2 pt-6">
          <p className="text-sm text-muted-foreground">
            Wrong email?{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Log out and sign up again
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
