
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { sendPasswordReset } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MailQuestion, ArrowLeft, Send, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

const ForgotPasswordSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
});

type ForgotPasswordFormValues = z.infer<typeof ForgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(ForgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setIsSubmitting(true);
    setSubmissionError(null);
    setSubmissionSuccess(false);
    try {
      await sendPasswordReset(data.email);
      setSubmissionSuccess(true);
    } catch (error) {
      if ((error as { code?: string })?.code === 'auth/user-not-found') {
        setSubmissionError('No account found with that email address.');
      } else {
        setSubmissionError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex w-full items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <MailQuestion className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-3xl font-headline">Forgot Password</CardTitle>
          <CardDescription>
            {submissionSuccess
              ? 'Check your inbox for the reset link.'
              : 'Enter your email to receive a password reset link. If you signed up with Google, use Google to sign in instead — no password reset is needed.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submissionSuccess ? (
            <Alert variant="default" className="border-green-500 bg-green-500/10 text-green-700">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertTitle>Email Sent!</AlertTitle>
              <AlertDescription>
                A password reset link has been sent to your email address. Please check your spam folder if you
                don&apos;t see it.
              </AlertDescription>
            </Alert>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="you@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {submissionError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{submissionError}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" /> Send Reset Link
                    </>
                  )}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-4 pt-6">
          <Button variant="link" asChild className="text-sm">
            <Link href="/login">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Log In
            </Link>
          </Button>
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
