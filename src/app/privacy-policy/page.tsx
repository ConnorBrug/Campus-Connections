
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ShieldCheck, ArrowLeft } from "lucide-react";
const LAST_UPDATED = 'February 10, 2026';

export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto py-8 px-4 md:px-6 flex flex-col items-center">
      <Card className="w-full max-w-3xl shadow-xl">
        <CardHeader className="text-center border-b pb-4">
          <div className="flex justify-center mb-4">
            <ShieldCheck className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-3xl font-headline">Privacy Policy</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            {`Last Updated: ${LAST_UPDATED}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 py-6 px-4 md:px-8">
          <p className="text-muted-foreground">
            Welcome to Connections. Your privacy matters to us. This Privacy Policy explains what information we collect,
            how we use it, and the choices you have when using the app.
          </p>
          
          <h2 className="text-xl font-semibold font-headline text-primary-foreground/90 pt-4">1. Information We Collect</h2>
          <p className="text-muted-foreground">
            We may collect information you provide directly, such as your name, email address, school information, and
            trip details. We may also collect limited technical data needed to operate and secure the service.
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>Account information, such as your name, email, and school details.</li>
            <li>Trip and matching information, such as airport, flight time, and bag count.</li>
            <li>Technical information, such as IP address, browser type, and device information.</li>
          </ul>

          <h2 className="text-xl font-semibold font-headline text-primary-foreground/90 pt-4">2. How We Use Your Information</h2>
          <p className="text-muted-foreground">
            We use your information to provide and improve the service, including to:
          </p>
           <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>Create and manage accounts.</li>
            <li>Match riders with compatible trip plans.</li>
            <li>Send service-related updates and support responses.</li>
            <li>Improve reliability, safety, and product quality.</li>
            <li>Detect, prevent, and investigate abuse or fraud.</li>
          </ul>

          <h2 className="text-xl font-semibold font-headline text-primary-foreground/90 pt-4">3. Disclosure of Your Information</h2>
          <p className="text-muted-foreground">
            We share information only when necessary to run the service, comply with legal obligations, or protect users.
          </p>
           <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>Service providers that help us host, secure, or operate the app.</li>
            <li>Legal authorities when required by law.</li>
            <li>Other parties in connection with a merger, sale, or reorganization.</li>
            <li>Additional sharing that you explicitly authorize.</li>
          </ul>
          
          <h2 className="text-xl font-semibold font-headline text-primary-foreground/90 pt-4">4. Security of Your Information</h2>
          <p className="text-muted-foreground">
            We use administrative, technical, and physical safeguards to protect your information. No system is completely
            secure, but we work to reduce risk and respond quickly when issues are identified.
          </p>

          <h2 className="text-xl font-semibold font-headline text-primary-foreground/90 pt-4">5. Your Data Protection Rights</h2>
          <p className="text-muted-foreground">
            Depending on where you live, you may have rights to access, correct, or delete your personal information. You
            may also have rights to limit or object to certain processing.
          </p>

          <h2 className="text-xl font-semibold font-headline text-primary-foreground/90 pt-4">6. Changes to This Privacy Policy</h2>
          <p className="text-muted-foreground">
            We may update this Privacy Policy from time to time. When we do, we will update the date at the top of this
            page and post the revised policy here.
          </p>

          <h2 className="text-xl font-semibold font-headline text-primary-foreground/90 pt-4">7. Contact Us</h2>
          <p className="text-muted-foreground">
            If you have questions about this Privacy Policy, please contact the Connections support team through the app.
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
