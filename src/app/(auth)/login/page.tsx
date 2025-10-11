
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { login } from "@/lib/auth";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { CarFront, LogIn, AlertTriangle, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    if (pageError) {
      setPageError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setPageError(null);
    try {
      const userProfile = await login(email, password);
      toast({ title: "Login Successful!", description: `Welcome back, ${userProfile?.name || 'friend'}!` });
      router.push("/main"); 
    } catch (error: any) {
      // Prioritize a specific message if available
      if (error.message && !error.code) {
          setPageError(error.message);
      } else if (error.code) {
        switch (error.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            setPageError("Invalid email or password.");
            break;
          case 'auth/too-many-requests':
            setPageError("Too many login attempts. Please try again later.");
            break;
          case 'auth/invalid-email':
            setPageError("Please enter a valid email address.");
            break;
          default:
            setPageError("An unexpected error occurred during login.");
            console.error("Login error:", error);
        }
      } else {
        setPageError("Login failed. Please check your credentials.");
      }
    } finally {
        setIsSubmitting(false);
    }
  };
  
  if (isSubmitting) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-2 text-muted-foreground">Logging you in...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl">
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
                  <AlertDescription>
                      {pageError}
                  </AlertDescription>
              </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="you@example.com" required value={email} onChange={handleInputChange(setEmail)} autoComplete="email" disabled={isSubmitting} />
            </div>
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                     <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
                        Forgot password?
                    </Link>
                </div>
              <Input id="password" name="password" type="password" placeholder="Password" required value={password} onChange={handleInputChange(setPassword)} autoComplete="current-password" disabled={isSubmitting} />
            </div>
             <Button type="submit" className="w-full" disabled={isSubmitting}>
                Login
                <LogIn className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center pt-4">
            <div className="flex w-full flex-col items-center space-y-4">
                <div className="flex flex-col items-center space-y-2">
                     <p className="text-sm text-muted-foreground">
                        Don&apos;t have an account?{' '}
                        <Link href="/signup" className="font-medium text-primary hover:underline">
                          Sign up
                        </Link>
                    </p>
                </div>
            </div>
        </CardFooter>
      </Card>
    </div>
  );
}
