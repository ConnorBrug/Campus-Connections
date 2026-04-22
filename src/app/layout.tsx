
import type {Metadata, Viewport} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { Inter, Space_Grotesk } from 'next/font/google';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://campus-connections.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Campus Connections',
    template: '%s | Campus Connections',
  },
  description:
    'Share airport rides with verified students from your school. Split the fare, cut the wait, and travel with people headed the same way.',
  applicationName: 'Campus Connections',
  keywords: [
    'campus rideshare',
    'airport shuttle',
    'student rideshare',
    'college airport ride',
    'split airport taxi',
  ],
  authors: [{ name: 'Campus Connections' }],
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Campus Connections',
    title: 'Campus Connections',
    description:
      'Share airport rides with verified students from your school. Split the fare, cut the wait.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Campus Connections',
    description:
      'Share airport rides with verified students from your school.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: { canonical: '/' },
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
};

// Setup fonts with next/font
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space-grotesk',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-body antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
