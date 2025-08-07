
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export default function VerifyEmailPage() {
  const router = useRouter();
  
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl text-center">
        <CardHeader>
          <div className="mb-4 flex justify-center">
            <CheckCircle2 className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-3xl font-headline">
            Email Verification Not Required
          </CardTitle>
          <CardDescription className="text-lg">
            For this MVP version of the app, your account is automatically verified.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <Button onClick={() => router.push('/login')} className="w-full">
                Proceed to Login
            </Button>
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-2 pt-6">
          <p className="text-sm text-muted-foreground">
            Signed up with the wrong email?{' '}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Create a new account
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
