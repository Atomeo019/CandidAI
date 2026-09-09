'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';
import { Flame, ArrowRight } from 'lucide-react';
import { Button } from '@/components/brand/Button';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '#verdicts', label: 'Verdicts' },
  { href: '#features', label: 'Features' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <header
      className={cn(
        'fixed top-0 inset-x-0 z-50 transition-colors duration-300 border-b',
        scrolled || open
          ? 'bg-background/85 backdrop-blur-md border-border'
          : 'bg-transparent border-transparent'
      )}
    >
      <div className="max-w-6xl mx-auto px-5 md:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <Flame className="w-5 h-5 text-gold" />
          <span className="font-display text-2xl uppercase tracking-wide leading-none pt-0.5">
            CandidAI
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-4">
          <SignedIn>
            <UserButton />
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground/60 hover:text-foreground transition-colors">
                Sign In
              </button>
            </SignInButton>
          </SignedOut>
          <Button asChild size="sm">
            <Link href="/dashboard">
              Get Roasted
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Button>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="md:hidden relative w-8 h-8 flex flex-col items-center justify-center gap-[6px]"
        >
          <span
            className={cn(
              'block w-5 h-px bg-foreground transition-transform duration-300',
              open && 'translate-y-[3.5px] rotate-45'
            )}
          />
          <span
            className={cn(
              'block w-5 h-px bg-foreground transition-transform duration-300',
              open && '-translate-y-[3.5px] -rotate-45'
            )}
          />
        </button>
      </div>

      {/* Mobile overlay */}
      <div
        className={cn(
          'md:hidden fixed inset-x-0 top-16 bottom-0 bg-background transition-opacity duration-300',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      >
        <div className="flex flex-col h-full px-6 pt-10 pb-12">
          <nav className="flex flex-col gap-2">
            {LINKS.map(({ href, label }, i) => (
              <a
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="font-display uppercase text-4xl py-2 text-foreground/80 hover:text-gold transition-colors"
                style={{ transitionDelay: `${i * 30}ms` }}
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-4">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="font-mono text-xs uppercase tracking-[0.2em] text-foreground/60 hover:text-foreground transition-colors py-3">
                  Sign In
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <div className="flex justify-center py-2">
                <UserButton />
              </div>
            </SignedIn>
            <Button asChild size="lg" className="w-full">
              <Link href="/dashboard" onClick={() => setOpen(false)}>
                <Flame className="w-4 h-4" />
                Get Roasted — Free
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
