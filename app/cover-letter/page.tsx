'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import {
  Sparkles,
  ArrowLeft,
  Copy,
  Check,
  Loader2,
  FileText,
  Lock,
  AlertCircle,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Paragraphs {
  hook:  string;
  body:  string;
  close: string;
}

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
    <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/60 bg-slate-800/40">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          {index + 1} · {label}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
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
      <p className="px-5 py-4 text-slate-200 text-sm leading-relaxed">{text}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CoverLetterPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();

  const [status, setStatus]         = useState<'checking' | 'generating' | 'done' | 'error' | 'gate'>('checking');
  const [paragraphs, setParagraphs] = useState<Paragraphs | null>(null);
  const [fullText, setFullText]     = useState('');
  const [errorMsg, setErrorMsg]     = useState('');
  const [copiedAll, setCopiedAll]   = useState(false);

  const generate = useCallback(async (jd: string, analysis: object) => {
    setStatus('generating');
    try {
      const res = await fetch('/api/apply-full', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ jd, analysis }),
      });
      const data = await res.json();
      if (data.ok) {
        setParagraphs(data.paragraphs);
        setFullText(data.cover_letter);
        setStatus('done');
      } else {
        setErrorMsg(data.error ?? 'Generation failed. Please try again.');
        setStatus('error');
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    // Must be signed in — otherwise the purchase can't be verified
    if (!isSignedIn) {
      router.replace('/dashboard');
      return;
    }

    // Check paid status
    fetch('/api/user/usage')
      .then(r => r.json())
      .then(d => {
        if (!d.hasFullAccess) {
          setStatus('gate');
          return;
        }

        // Read JD + analysis stored by results page before redirect
        const jd       = sessionStorage.getItem('cl_jd') ?? '';
        const rawAnal  = sessionStorage.getItem('cl_analysis') ?? '';

        if (!jd || !rawAnal) {
          // No stored data — user navigated here directly; send them back
          router.replace('/dashboard');
          return;
        }

        let analysis: object;
        try { analysis = JSON.parse(rawAnal); }
        catch { router.replace('/dashboard'); return; }

        // Clear storage so a back-navigation doesn't re-generate
        sessionStorage.removeItem('cl_jd');
        sessionStorage.removeItem('cl_analysis');

        generate(jd, analysis);
      })
      .catch(() => {
        setErrorMsg('Could not verify your access. Please try again.');
        setStatus('error');
      });
  }, [isLoaded, isSignedIn, generate, router]);

  const copyAll = () => {
    navigator.clipboard.writeText(fullText).then(() => {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    });
  };

  // ── Render helpers ─────────────────────────────────────────────────────────

  if (status === 'checking' || !isLoaded) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (status === 'gate') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8 text-purple-400" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Access Required</h2>
          <p className="text-slate-400 mb-6 text-sm leading-relaxed">
            Unlimited parses + full cover letters unlock for <span className="text-white font-semibold">$4.99</span> — one-time, no subscription.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-3 rounded-lg gradient-purple text-white font-semibold hover:opacity-90 transition-opacity"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Generation Failed</h2>
          <p className="text-slate-400 mb-6 text-sm">{errorMsg}</p>
          <button
            onClick={() => router.back()}
            className="px-6 py-3 rounded-lg gradient-purple text-white font-semibold hover:opacity-90 transition-opacity"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (status === 'generating') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-14 h-14 text-purple-400 animate-spin mx-auto mb-5" />
          <h2 className="text-xl font-bold mb-2">Writing your cover letter…</h2>
          <p className="text-slate-400 text-sm">Usually under 10 seconds. No filler. No flattery.</p>
        </div>
      </div>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950">

      {/* Nav */}
      <nav className="border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Results
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-purple-500" />
            <span className="text-xl font-bold gradient-text">CandidAI</span>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12 space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-6 h-6 text-purple-400" />
              <h1 className="text-2xl md:text-3xl font-bold">Your Cover Letter</h1>
            </div>
            <p className="text-slate-400 text-sm">
              3 tight paragraphs, ruthlessly tailored to the job description.
            </p>
          </div>

          <button
            onClick={copyAll}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-colors"
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
        <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl px-5 py-4">
          <p className="text-slate-400 text-xs leading-relaxed">
            <span className="text-slate-300 font-medium">Pro tip:</span> This letter was written for the specific JD you pasted. Swap in a new JD on the results page to generate a fresh version for another role — each analysis is independent.
          </p>
        </div>

      </main>
    </div>
  );
}
