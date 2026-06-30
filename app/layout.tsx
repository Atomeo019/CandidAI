import './globals.css';
import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://candidai.app'
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
      <html lang="en">
        <body>
          {children}
          <Toaster position="bottom-center" richColors />
        </body>
      </html>
    </ClerkProvider>
  );
}
