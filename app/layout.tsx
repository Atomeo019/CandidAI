import './globals.css';
import type { Metadata } from 'next';
import { Bebas_Neue, DM_Sans, DM_Mono } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { Toaster } from 'sonner';

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
});
const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-sans',
});
const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  metadataBase: new URL(
    // NEXT_PUBLIC_SITE_URL is the canonical name; NEXT_PUBLIC_BASE_URL is
    // accepted because that is what .env.local has always defined. Reading only
    // the first meant this silently fell through to the hardcoded default on
    // every preview deployment.
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? 'https://candidai.app'
  ),
  title: 'CandidAI — Brutally Honest Resume Analysis',
  description:
    'Find out exactly why your resume gets filtered out. CandidAI scores your resume against top-25% competitive tech internship standards — ATS first, then recruiter lens. No sugarcoating.',
  openGraph: {
    title: 'CandidAI — Brutally Honest Resume Analysis',
    description:
      'Find out exactly why your resume gets filtered out. Scored against top-25% competitive tech internship standards.',
    url: 'https://candidai.app',
    siteName: 'CandidAI',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CandidAI — Brutally Honest Resume Analysis',
    description:
      'Find out exactly why your resume gets filtered out. ATS filter first. Then recruiter lens. No sugarcoating.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${bebasNeue.variable} ${dmSans.variable} ${dmMono.variable}`}>
        <body>
          {children}
          <Toaster position="bottom-center" richColors />
        </body>
      </html>
    </ClerkProvider>
  );
}
