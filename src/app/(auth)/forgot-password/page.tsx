
'use client';

import { Card, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import Link from "next/link";
import { MailQuestion, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <MailQuestion className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-3xl font-headline">Forgot Password</CardTitle>
          <CardDescription>
            The password reset feature is currently disabled for this MVP version. Please contact support or create a new account.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col items-center space-y-2 pt-6">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Sign up here
            </Link>
          </p>
           <Button variant="link" asChild className="text-sm">
             <Link href="/login">
                <ArrowLeft className="mr-2 h-4 w-4" /> Go Back to Login
             </Link>
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
