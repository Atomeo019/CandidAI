import * as React from 'react';
import Link from 'next/link';
import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Shared shell for legal / policy pages — brand nav, title block, footer. */
function LegalShell({
  label,
  title,
  subtitle,
  children,
}: {
  label: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border sticky top-0 bg-background/85 backdrop-blur-md z-40">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-gold" />
            <span className="font-display text-2xl uppercase tracking-wide leading-none pt-0.5">
              CandidAI
            </span>
          </Link>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {label}
          </span>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-14 md:py-16 space-y-12">
        <div>
          <h1 className="font-display uppercase text-4xl md:text-5xl leading-[0.95] tracking-tight mb-3">
            {title}
          </h1>
          {subtitle && (
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
        {children}
      </main>

      <footer className="border-t border-border mt-12 py-8">
        <div className="max-w-3xl mx-auto px-6 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          <Link href="/cookie-policy" className="hover:text-foreground transition-colors">Cookies</Link>
          <Link href="/refund-policy" className="hover:text-foreground transition-colors">Refunds</Link>
          <Link href="/ai-disclaimer" className="hover:text-foreground transition-colors">AI Disclaimer</Link>
          <Link href="/upload-disclosure" className="hover:text-foreground transition-colors">Upload Disclosure</Link>
        </div>
      </footer>
    </div>
  );
}

/** Body section with a display heading. */
function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display uppercase text-2xl tracking-tight">{title}</h2>
      <div className="text-foreground/70 leading-relaxed text-sm space-y-2">{children}</div>
    </section>
  );
}

/** Highlighted callout box. tone drives the accent color. */
function LegalCallout({
  tone = 'gold',
  title,
  children,
  className,
}: {
  tone?: 'gold' | 'confirm' | 'danger';
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const tones = {
    gold: 'border-gold/30 bg-gold/5',
    confirm: 'border-green-500/25 bg-green-500/5',
    danger: 'border-destructive/40 bg-destructive/5',
  };
  const titleTones = {
    gold: 'text-gold',
    confirm: 'text-green-400',
    danger: 'text-red-400',
  };
  return (
    <div className={cn('border px-6 py-5', tones[tone], className)}>
      {title && (
        <p className={cn('font-mono text-xs uppercase tracking-[0.15em] font-medium mb-2', titleTones[tone])}>
          {title}
        </p>
      )}
      <div className="text-foreground/70 text-sm leading-relaxed space-y-2">{children}</div>
    </div>
  );
}

/** Inline link style used inside legal copy. */
const legalLink = 'text-gold hover:underline underline-offset-4';
/** Inline code chip used inside legal copy. */
const legalCode = 'font-mono text-gold/90 bg-card border border-border px-1.5 py-0.5 text-xs';

export { LegalShell, LegalSection, LegalCallout, legalLink, legalCode };
