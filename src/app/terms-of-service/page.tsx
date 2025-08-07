
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FileText, ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";

export default function TermsOfServicePage() {
  const [lastUpdated, setLastUpdated] = useState('');

  useEffect(() => {
    setLastUpdated(new Date().toLocaleDateString());
  }, []);

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 flex flex-col items-center">
      <Card className="w-full max-w-3xl shadow-xl">
        <CardHeader className="text-center border-b pb-4">
          <div className="flex justify-center mb-4">
            <FileText className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-3xl font-headline">Terms of Service</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            {lastUpdated ? `Last Updated: ${lastUpdated}` : 'Loading...'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 py-6 px-4 md:px-8">
          <p className="text-muted-foreground">
            Welcome to Connections! These terms and conditions outline the rules and regulations for the use of Connections's Website, located at [Your Website URL].
          </p>
          <p className="text-muted-foreground">
            By accessing this website we assume you accept these terms and conditions. Do not continue to use Connections if you do not agree to take all of the terms and conditions stated on this page.
          </p>
          
          <h2 className="text-xl font-semibold font-headline text-primary-foreground/90 pt-4">1. Introduction</h2>
          <p className="text-muted-foreground">
            This is a placeholder Terms of Service document. In a real application, this section would detail the agreement between the user and the service provider. It would cover aspects like user responsibilities, service limitations, intellectual property rights, and dispute resolution.
          </p>

          <h2 className="text-xl font-semibold font-headline text-primary-foreground/90 pt-4">2. User Accounts</h2>
          <p className="text-muted-foreground">
            When you create an account with us, you must provide us information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account on our Service.
          </p>
          
          <h2 className="text-xl font-semibold font-headline text-primary-foreground/90 pt-4">3. Content</h2>
          <p className="text-muted-foreground">
            Our Service allows you to post, link, store, share and otherwise make available certain information, text, graphics, videos, or other material. You are responsible for the Content that you post to the Service, including its legality, reliability, and appropriateness.
          </p>

          <h2 className="text-xl font-semibold font-headline text-primary-foreground/90 pt-4">4. Prohibited Uses</h2>
          <p className="text-muted-foreground">
            You may use the Service only for lawful purposes and in accordance with Terms. You agree not to use the Service in any way that violates any applicable national or international law or regulation.
          </p>

          <h2 className="text-xl font-semibold font-headline text-primary-foreground/90 pt-4">5. Termination</h2>
          <p className="text-muted-foreground">
            We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
          </p>
          
          <h2 className="text-xl font-semibold font-headline text-primary-foreground/90 pt-4">6. Governing Law</h2>
          <p className="text-muted-foreground">
            These Terms shall be governed and construed in accordance with the laws of [Your Jurisdiction], without regard to its conflict of law provisions.
          </p>

          <h2 className="text-xl font-semibold font-headline text-primary-foreground/90 pt-4">7. Changes to Terms</h2>
          <p className="text-muted-foreground">
            We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material we will try to provide at least 30 days' notice prior to any new terms taking effect.
          </p>

          <h2 className="text-xl font-semibold font-headline text-primary-foreground/90 pt-4">8. Contact Us</h2>
          <p className="text-muted-foreground">
            If you have any questions about these Terms, please contact us at [Your Contact Email/Link].
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
