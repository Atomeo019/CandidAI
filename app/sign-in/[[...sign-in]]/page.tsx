import Link from 'next/link';
import { SignIn } from '@clerk/nextjs';
import { Flame } from 'lucide-react';

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-6 py-12">
      <Link href="/" className="flex items-center gap-2 mb-8">
        <Flame className="w-5 h-5 text-gold" />
        <span className="font-display text-3xl uppercase tracking-wide leading-none pt-0.5">
          CandidAI
        </span>
      </Link>
      <SignIn />
      <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
        3 free analyses &middot; No card required
      </p>
    </div>
  );
}
