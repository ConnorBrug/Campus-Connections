
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";

export default function PrivacyPolicyPage() {
  const [lastUpdated, setLastUpdated] = useState('');

  useEffect(() => {
    setLastUpdated(new Date().toLocaleDateString());
  }, []);

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 flex flex-col items-center">
      <Card className="w-full max-w-3xl shadow-xl">
        <CardHeader className="text-center border-b pb-4">
          <div className="flex justify-center mb-4">
            <ShieldCheck className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-3xl font-headline">Privacy Policy</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            {lastUpdated ? `Last Updated: ${lastUpdated}` : 'Loading...'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 py-6 px-4 md:px-8">
          <p className="text-muted-foreground">
            Welcome to Connections! Your privacy is important to us. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website [Your Website URL] and use our services.
          </p>
          
          <h2 className="text-xl font-semibold font-headline text-primary-foreground/90 pt-4">1. Information We Collect</h2>
          <p className="text-muted-foreground">
            This is a placeholder Privacy Policy document. In a real application, this section would detail the types of personal and non-personal information collected from users (e.g., name, email, university, usage data, cookies).
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>Personal Identifiable Information (PII) such as name, email, university, etc.</li>
            <li>Information automatically collected such as IP address, browser type, operating system.</li>
            <li>Information from third parties, if applicable.</li>
          </ul>

          <h2 className="text-xl font-semibold font-headline text-primary-foreground/90 pt-4">2. How We Use Your Information</h2>
          <p className="text-muted-foreground">
            We may use information collected about you in various ways, including to:
          </p>
           <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>Provide, operate, and maintain our Service.</li>
            <li>Improve, personalize, and expand our Service.</li>
            <li>Understand and analyze how you use our Service.</li>
            <li>Develop new products, services, features, and functionality.</li>
            <li>Communicate with you, either directly or through one of our partners.</li>
            <li>Process your transactions and manage your orders.</li>
            <li>Find and prevent fraud.</li>
          </ul>

          <h2 className="text-xl font-semibold font-headline text-primary-foreground/90 pt-4">3. Disclosure of Your Information</h2>
          <p className="text-muted-foreground">
            We may share information we have collected about you in certain situations. Your information may be disclosed as follows:
          </p>
           <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>By Law or to Protect Rights.</li>
            <li>Third-Party Service Providers.</li>
            <li>Business Transfers.</li>
            <li>With Your Consent.</li>
          </ul>
          
          <h2 className="text-xl font-semibold font-headline text-primary-foreground/90 pt-4">4. Security of Your Information</h2>
          <p className="text-muted-foreground">
            We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse.
          </p>

          <h2 className="text-xl font-semibold font-headline text-primary-foreground/90 pt-4">5. Your Data Protection Rights</h2>
          <p className="text-muted-foreground">
            Depending on your location, you may have certain rights regarding your personal information, such as the right to access, correct, or delete your data.
          </p>

          <h2 className="text-xl font-semibold font-headline text-primary-foreground/90 pt-4">6. Changes to This Privacy Policy</h2>
          <p className="text-muted-foreground">
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.
          </p>

          <h2 className="text-xl font-semibold font-headline text-primary-foreground/90 pt-4">7. Contact Us</h2>
          <p className="text-muted-foreground">
            If you have any questions about this Privacy Policy, please contact us at [Your Contact Email/Link].
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
