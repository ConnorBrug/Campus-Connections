
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FileText, ArrowLeft } from "lucide-react";
const LAST_UPDATED = 'February 10, 2026';

export default function TermsOfServicePage() {
  return (
    <div className="container mx-auto py-8 px-4 md:px-6 flex flex-col items-center">
      <Card className="w-full max-w-3xl shadow-xl">
        <CardHeader className="text-center border-b pb-4">
          <div className="flex justify-center mb-4">
            <FileText className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-3xl font-headline">Terms of Service</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            {`Last Updated: ${LAST_UPDATED}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 py-6 px-4 md:px-8">
          <p className="text-muted-foreground">
            Welcome to Connections. These Terms of Service explain the rules for using the app.
          </p>
          <p className="text-muted-foreground">
            By creating an account or using Connections, you agree to these terms. If you do not agree, please do not use
            the service.
          </p>
          
          <h2 className="text-xl font-semibold font-headline text-primary-foreground/90 pt-4">1. Introduction</h2>
          <p className="text-muted-foreground">
            Connections helps students coordinate shared airport rides. These terms govern your use of the product and your
            relationship with the service.
          </p>

          <h2 className="text-xl font-semibold font-headline text-primary-foreground/90 pt-4">2. User Accounts</h2>
          <p className="text-muted-foreground">
            You must provide accurate, current information when creating and maintaining an account. You are responsible for
            account activity and for keeping your login credentials secure.
          </p>
          
          <h2 className="text-xl font-semibold font-headline text-primary-foreground/90 pt-4">3. User Content and Conduct</h2>
          <p className="text-muted-foreground">
            You are responsible for any information you submit, including profile, trip, and chat content. You agree not to
            post unlawful, abusive, or misleading content, and not to use the service in ways that may harm others.
          </p>

          <h2 className="text-xl font-semibold font-headline text-primary-foreground/90 pt-4">4. Prohibited Uses</h2>
          <p className="text-muted-foreground">
            You may use the service only for lawful purposes. Prohibited activity includes impersonation, harassment,
            unauthorized access, and interference with normal operation of the app.
          </p>

          <h2 className="text-xl font-semibold font-headline text-primary-foreground/90 pt-4">5. Termination</h2>
          <p className="text-muted-foreground">
            We may suspend or terminate accounts that violate these terms, threaten user safety, or misuse the platform.
          </p>
          
          <h2 className="text-xl font-semibold font-headline text-primary-foreground/90 pt-4">6. Governing Law</h2>
          <p className="text-muted-foreground">
            These terms are governed by applicable law in the jurisdiction where the service operator is based.
          </p>

          <h2 className="text-xl font-semibold font-headline text-primary-foreground/90 pt-4">7. Changes to Terms</h2>
          <p className="text-muted-foreground">
            We may update these terms periodically. When material changes are made, we will provide notice in the app or by
            other reasonable means.
          </p>

          <h2 className="text-xl font-semibold font-headline text-primary-foreground/90 pt-4">8. Contact Us</h2>
          <p className="text-muted-foreground">
            If you have questions about these terms, please contact the Connections support team through the app.
          </p>

          <div className="text-center mt-8 pt-6 border-t">
            <Button asChild variant="outline">
                <Link href="/signup">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Sign Up
                </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
