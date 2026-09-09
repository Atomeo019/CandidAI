'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import {
  ArrowLeft,
  Copy,
  Check,
  Loader2,
  FileText,
  Lock,
  AlertCircle,
  Flame,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Paragraphs {
  hook:  string;
  body:  string;
  close: string;
}

// How long to keep re-checking for full access after returning from checkout.
// Whop's webhook routinely lands a few seconds after the browser redirect, so a
// single check on mount showed paying customers the paywall as the NORMAL case.
const ACCESS_POLL_TIMEOUT_MS  = 25_000;
const ACCESS_POLL_INTERVAL_MS = 2_000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ── Paragraph card ─────────────────────────────────────────────────────────────

function ParagraphCard({
  label,
  text,
  index,
}: {
  label: string;
  text: string;
  index: number;
}) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="bg-card border border-border overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-background/60">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {String(index + 1).padStart(2, '0')} &middot; {label}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-400" />
              <span className="text-green-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copy
            </>
          )}
        </button>
      </div>
      <p className="px-5 py-4 text-foreground/80 text-sm leading-relaxed">{text}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CoverLetterPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();

  const [status, setStatus]         = useState<'checking' | 'confirming' | 'generating' | 'done' | 'error' | 'gate'>('checking');
  const [paragraphs, setParagraphs] = useState<Paragraphs | null>(null);
  const [fullText, setFullText]     = useState('');
  const [errorMsg, setErrorMsg]     = useState('');
  const [copiedAll, setCopiedAll]   = useState(false);

  // The JD and analysis are kept in state for the lifetime of the page so a
  // failed generation can be retried. sessionStorage used to be cleared BEFORE
  // generating, which meant one Groq timeout left a paying customer with an
  // error screen, an empty form behind it, and nothing to retry with.
  const jdRef       = useRef<string>('');
  const analysisRef = useRef<object | null>(null);
  const [canRetry, setCanRetry] = useState(false);

  // Post-checkout recovery
  const [justPaid, setJustPaid]         = useState(false);
  const [claimEmail, setClaimEmail]     = useState('');
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimError, setClaimError]     = useState<string | null>(null);

  const generate = useCallback(async (jd: string, analysis: object) => {
    setStatus('generating');
    setCanRetry(false);
    try {
      const res = await fetch('/api/apply-full', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ jd, analysis }),
      });

      // A 504 or CDN error page is HTML, not JSON — parsing it would throw a
      // SyntaxError and surface as the wrong message.
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        setErrorMsg('The server took too long to respond. Your access is safe — try again.');
        setCanRetry(true);
        setStatus('error');
        return;
      }

      const data = await res.json();
      if (data.ok) {
        setParagraphs(data.paragraphs);
        setFullText(data.cover_letter);
        // Clear only now that the letter exists. A back-navigation re-runs the
        // mount effect, finds nothing stored, and bounces to the dashboard —
        // the same behaviour as before, without the data loss on failure.
        try {
          sessionStorage.removeItem('cl_jd');
          sessionStorage.removeItem('cl_analysis');
        } catch { /* private browsing — nothing to clear */ }
        setStatus('done');
      } else {
        setErrorMsg(data.error ?? 'Generation failed. Please try again.');
        setCanRetry(true);
        setStatus('error');
      }
    } catch {
      setErrorMsg('Network error. Your access is safe — try again.');
      setCanRetry(true);
      setStatus('error');
    }
  }, []);

  const retry = useCallback(() => {
    if (!analysisRef.current) {
      router.replace('/dashboard');
      return;
    }
    generate(jdRef.current, analysisRef.current);
  }, [generate, router]);

  useEffect(() => {
    if (!isLoaded) return;

    // Must be signed in — otherwise the purchase can't be verified
    if (!isSignedIn) {
      router.replace('/dashboard');
      return;
    }

    const paid = typeof window !== 'undefined'
      && new URLSearchParams(window.location.search).get('unlocked') === 'true';
    setJustPaid(paid);

    // Read the JD + analysis stored by the results page. Read only — nothing is
    // removed until a letter has actually been produced.
    let storedJd = '';
    let rawAnalysis = '';
    try {
      storedJd    = sessionStorage.getItem('cl_jd') ?? '';
      rawAnalysis = sessionStorage.getItem('cl_analysis') ?? '';
    } catch { /* private browsing */ }

    if (!storedJd || !rawAnalysis) {
      // Nothing to generate from. If they have just paid, send them to the
      // dashboard with the flag still set so the claim banner is there.
      router.replace(paid ? '/dashboard?unlocked=true' : '/dashboard');
      return;
    }

    let analysis: object;
    try {
      analysis = JSON.parse(rawAnalysis);
    } catch {
      router.replace('/dashboard');
      return;
    }

    jdRef.current       = storedJd;
    analysisRef.current = analysis;

    let cancelled = false;

    (async () => {
      // Poll for access. Someone arriving from checkout gets the full window;
      // anyone else gets a single check, because for them a false answer is the
      // truth rather than a race with the webhook.
      const deadline = Date.now() + (paid ? ACCESS_POLL_TIMEOUT_MS : 0);
      let granted = false;
      let announced = false;

      while (!cancelled) {
        try {
          const res  = await fetch('/api/user/usage');
          const data = await res.json();
          if (data.hasFullAccess) { granted = true; break; }
        } catch {
          if (!paid) {
            if (!cancelled) {
              setErrorMsg('Could not verify your access. Please try again.');
              setCanRetry(false);
              setStatus('error');
            }
            return;
          }
          // Just paid — a transient network blip should not cost them the
          // purchase. Keep trying until the deadline.
        }

        if (Date.now() >= deadline) break;
        if (!announced) { setStatus('confirming'); announced = true; }
        await sleep(ACCESS_POLL_INTERVAL_MS);
      }

      if (cancelled) return;

      if (!granted) {
        setStatus('gate');
        return;
      }

      generate(storedJd, analysis);
    })();

    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn, generate, router]);

  const handleClaim = async () => {
    const email = claimEmail.trim().toLowerCase();
    if (!email) return;
    setClaimLoading(true);
    setClaimError(null);
    try {
      const res  = await fetch('/api/whop/claim', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ buyerEmail: email }),
      });
      const data = await res.json();
      if (data.ok && analysisRef.current) {
        generate(jdRef.current, analysisRef.current);
        return;
      }
      setClaimError(data.error ?? 'No purchase found for that email.');
    } catch {
      setClaimError('Network error. Please try again.');
    } finally {
      setClaimLoading(false);
    }
  };

  const copyAll = () => {
    navigator.clipboard.writeText(fullText).then(() => {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    });
  };

  // ── Render helpers ─────────────────────────────────────────────────────────

  if (status === 'checking' || !isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-gold animate-spin" />
      </div>
    );
  }

  if (status === 'confirming') {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <Loader2 className="w-14 h-14 text-gold animate-spin mx-auto mb-5" />
          <h2 className="font-display uppercase text-2xl tracking-tight mb-2">Confirming your purchase</h2>
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
            This takes a few seconds
          </p>
        </div>
      </div>
    );
  }

  if (status === 'gate') {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
        <div className="text-center max-w-sm w-full">
          <div className="w-16 h-16 rounded-full bg-gold/10 border border-gold/25 flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8 text-gold" />
          </div>

          {justPaid ? (
            <>
              <h2 className="font-display uppercase text-3xl tracking-tight mb-3">Almost there</h2>
              <p className="text-foreground/60 mb-6 text-sm leading-relaxed">
                We haven&apos;t received confirmation from Whop yet. If you paid with a different
                email, enter it below — it needs to be verified on this account.
              </p>

              <input
                type="email"
                value={claimEmail}
                onChange={(e) => { setClaimEmail(e.target.value); setClaimError(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleClaim(); }}
                placeholder="Email used at checkout"
                autoComplete="email"
                className="w-full h-11 px-4 mb-3 bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold transition-colors"
              />

              {claimError && (
                <p className="text-red-400 text-xs mb-3 leading-relaxed text-left">{claimError}</p>
              )}

              <button
                onClick={handleClaim}
                disabled={claimLoading || !claimEmail.trim()}
                className="w-full h-11 mb-3 bg-gold text-background font-mono text-xs uppercase tracking-[0.15em] hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {claimLoading ? 'Checking…' : 'Unlock my purchase'}
              </button>

              <p className="text-muted-foreground text-xs mb-5 leading-relaxed">
                Still nothing? Email <span className="text-foreground/80">atomeo.019@gmail.com</span> with
                your Whop receipt and we&apos;ll sort it out.
              </p>
            </>
          ) : (
            <>
              <h2 className="font-display uppercase text-3xl tracking-tight mb-3">Access Required</h2>
              <p className="text-foreground/60 mb-8 text-sm leading-relaxed">
                Unlimited parses + full cover letters unlock for <span className="text-gold font-semibold">$4.99</span> — one-time, no subscription.
              </p>
            </>
          )}

          <button
            onClick={() => router.push('/dashboard')}
            className="h-11 px-6 border border-border font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/25 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="font-display uppercase text-3xl tracking-tight mb-3">Generation Failed</h2>
          <p className="text-foreground/60 mb-8 text-sm">{errorMsg}</p>
          <div className="flex items-center justify-center gap-3">
            {canRetry && (
              <button
                onClick={retry}
                className="h-11 px-6 bg-gold text-background font-mono text-xs uppercase tracking-[0.15em] hover:bg-gold/90 transition-colors"
              >
                Try Again
              </button>
            )}
            <button
              onClick={() => router.push('/dashboard')}
              className="h-11 px-6 border border-border font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'generating') {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-14 h-14 text-gold animate-spin mx-auto mb-5" />
          <h2 className="font-display uppercase text-2xl tracking-tight mb-2">Writing your cover letter…</h2>
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Usually under 10 seconds. No filler. No flattery.</p>
        </div>
      </div>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Nav */}
      <nav className="border-b border-border sticky top-0 bg-background/85 backdrop-blur-md z-40">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Results
          </button>
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-gold" />
            <span className="font-display text-2xl uppercase tracking-wide leading-none pt-0.5">CandidAI</span>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-10 md:py-14 space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <FileText className="w-5 h-5 text-gold" />
              <h1 className="font-display uppercase text-3xl md:text-4xl tracking-tight">Your Cover Letter</h1>
            </div>
            <p className="text-foreground/60 text-sm">
              3 tight paragraphs, ruthlessly tailored to the job description.
            </p>
          </div>

          <button
            onClick={copyAll}
            className="flex items-center gap-2 h-11 px-5 bg-gold text-background font-mono text-xs uppercase tracking-[0.15em] hover:bg-gold/90 transition-colors"
          >
            {copiedAll ? (
              <>
                <Check className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy All
              </>
            )}
          </button>
        </div>

        {/* Paragraphs */}
        {paragraphs && (
          <div className="space-y-4">
            <ParagraphCard label="Hook — who you are + why you fit" text={paragraphs.hook}  index={0} />
            <ParagraphCard label="Evidence — prove the hook"         text={paragraphs.body}  index={1} />
            <ParagraphCard label="Close — company fit + the ask"    text={paragraphs.close} index={2} />
          </div>
        )}

        {/* Footer tip */}
        <div className="bg-card border border-border px-5 py-4">
          <p className="text-foreground/60 text-xs leading-relaxed">
            <span className="text-gold font-medium">Pro tip:</span> This letter was written for the specific JD you pasted. Swap in a new JD on the results page to generate a fresh version for another role — each analysis is independent.
          </p>
        </div>

      </main>
    </div>
  );
}
