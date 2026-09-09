'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useClerk, UserButton, useAuth, SignIn } from '@clerk/nextjs';
import type { APIResponse } from '@/lib/types';
import Link from 'next/link';
import {
  LayoutDashboard,
  FileText,
  Target,
  Settings,
  Upload,
  LogOut,
  X,
  Loader,
  Flame,
  Trophy,
  History,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/brand/Button';
import { FREE_PARSE_COPY } from '@/lib/constants';

// Must match the server-side guard in app/api/analyze/route.ts. It was 10
// here and 5 there, so a 7 MB PDF passed local validation and then came back
// as a 413 telling the user about a limit the upload screen never mentioned.
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

type HistoryRow = {
  id:            string;
  createdAt:     string;
  detectedRole:  string | null;
  tier:          string | null;
  contentScore:  number | null;
  atsScore:      number | null;
  roastHeadline: string | null;
  topPriority:   string | null;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function validateFile(file: File): string | null {
  if (file.type !== 'application/pdf') return 'Only PDF files are accepted.';
  if (file.size > MAX_FILE_SIZE_BYTES) return `File exceeds ${MAX_FILE_SIZE_MB}MB limit.`;
  return null;
}

export default function DashboardPage() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  // `status` drives all post-submission UI. Replaces the boolean `isAnalyzing`
  // so the button disappears after success instead of staying clickable.
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'done'>('idle');
  const [extractedPreview, setExtractedPreview] = useState<string | null>(null);
  // Synchronous ref lock — React state updates are async so a boolean state flag
  // can be read as `false` by a second click before the first setState commits.
  // The ref write is immediate and visible to any concurrent call.
  const isAnalyzingRef = useRef(false);
  const router = useRouter();
  const { signOut } = useClerk();
  const { isSignedIn, userId } = useAuth();

  // Parse gate state.
  // The old `localParseCount` mirror in localStorage is gone: the count is now
  // owned entirely by the server, incremented inside /api/analyze in the same
  // transaction that checks it. A number the browser keeps is a number the
  // browser can edit.
  const [serverRemaining, setServerRemaining] = useState<number | null>(null);
  const [hasFullAccess, setHasFullAccess] = useState(false);
  const [showSignInGate, setShowSignInGate] = useState(false);
  const [showPaywallGate, setShowPaywallGate] = useState(false);
  const [showClaimBanner, setShowClaimBanner] = useState(false);
  const [claimEmail, setClaimEmail] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState(false);

  // Analysis history. The privacy policy tells users their scores are kept "so
  // you can review past results" — until this existed there was no way to.
  const [history, setHistory]           = useState<HistoryRow[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [deletingData, setDeletingData] = useState(false);

  // Detect return from Whop checkout — show claim banner if access wasn't auto-applied
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('unlocked=true')) {
      window.history.replaceState({}, '', '/dashboard');
      // We'll check hasFullAccess after usage loads — see the next useEffect
      setShowClaimBanner(true);
    }
  }, []);

  // Load parse counts on mount and auth change
  useEffect(() => {
    if (isSignedIn) {
      // Close the sign-in gate modal now that the user is authenticated
      setShowSignInGate(false);
      fetch('/api/user/usage')
        .then(r => r.json())
        .then(d => {
          setServerRemaining(d.remaining ?? 0);
          const fa = d.hasFullAccess ?? false;
          setHasFullAccess(fa);
          // If access was already auto-applied, hide the claim banner
          if (fa) setShowClaimBanner(false);
        })
        .catch(() => setServerRemaining(null));

      fetch('/api/analyses')
        .then(r => r.json())
        .then(d => {
          if (d.ok) setHistory(d.analyses ?? []);
          else setHistoryError('Could not load your history.');
        })
        .catch(() => setHistoryError('Could not load your history.'));
    }
  }, [isSignedIn]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    // Use the ref — not status state — because state reads here are stale closures.
    // A drop during an in-flight request would swap uploadedFile while the fetch
    // is bound to the old FormData, causing preview text to mismatch the filename.
    if (isAnalyzingRef.current) return;
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const error = validateFile(file);
    if (error) { setFileError(error); return; }
    setFileError(null);
    setExtractedPreview(null);
    setStatus('idle');
    setUploadedFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const error = validateFile(file);
    if (error) {
      setFileError(error);
      e.target.value = '';
      return;
    }
    setFileError(null);
    setExtractedPreview(null);
    setStatus('idle');
    setUploadedFile(file);
  };

  // Single entry point for all analysis triggers (button click AND drag-drop).
  // Centralising here means the lock, cleanup, and state transitions can never
  // drift between the two call sites.
  const startAnalysis = async (file: File) => {
    // Fix 1 — synchronous ref check. React state (`status`) is async: a second
    // click can read stale `idle` before the first setState('analyzing') commits.
    // The ref write on the next line is immediate and shared across closures.
    // Require sign-in for all analyses — server enforces this too.
    // New accounts get 3 free parses, which is better than the old 1-anon-parse flow.
    if (!isSignedIn) {
      setShowSignInGate(true);
      return;
    }
    if (isSignedIn && !hasFullAccess && serverRemaining !== null && serverRemaining <= 0) {
      setShowPaywallGate(true);
      return;
    }

    if (isAnalyzingRef.current) return;
    isAnalyzingRef.current = true;

    setStatus('analyzing');
    setFileError(null);
    setExtractedPreview(null); // Fix 3 — clear stale preview before new request

    // Abort the request if it hasn't completed within 12s.
    // Vercel Hobby hard-kills functions at 10s — if that happens it returns a
    // Vercel HTML 504 page, not JSON. Without this controller the spinner hangs
    // forever because response.json() throws on HTML but the catch only fires
    // after the default browser fetch timeout (which can be minutes).
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), 12000);

    try {
      const formData = new FormData();
      formData.append('file', file); // uses the parameter, not captured state

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      // Vercel 504 / edge errors return HTML, not JSON — guard before parsing.
      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        setFileError('Analysis timed out. Please try again — large PDFs occasionally take longer.');
        setStatus('idle');
        return;
      }

      // Fix 6 — separate try/catch around JSON parse. Content-type can be
      // application/json while the body is still malformed (CDN error pages).
      // Without this, a SyntaxError propagates to the outer catch and shows
      // "Network error" which is the wrong message for this failure.
      let data: APIResponse;
      try {
        data = await response.json();
      } catch {
        setFileError('Server returned an unreadable response. Please try again.');
        setStatus('idle');
        return;
      }

      // HTTP-level errors (400, 422, 429, 500) — all return ErrorResponse shape
      if (!response.ok) {
        // Safely extract error message — data.ok is false for all backend errors
        const msg = !data.ok ? data.error : null;
        if (response.status === 429) {
          setFileError(msg ?? 'High demand right now. Please try again in a few minutes.');
        } else {
          setFileError(msg ?? 'Analysis failed. Please try again.');
        }
        setStatus('idle');
        return;
      }

      // API-level failure on a 200 (defensive — backend should not do this, but guard it)
      if (!data.ok) {
        setFileError(data.error ?? 'Analysis failed. Please try again.');
        setStatus('idle');
        return;
      }

      // Branch on mode — the single source of truth for what shape to expect
      if (data.mode === 'extraction') {
        if (!data.preview_text) {
          // ok:true + mode:extraction but no text — backend emitted a partial response
          setFileError('Extraction returned no text. Try re-exporting your PDF.');
          setStatus('idle');
          return;
        }
        setExtractedPreview(data.preview_text);
        setStatus('done'); // Fix 5 — 'done' hides the Analyze button
        return;
      }

      if (data.mode === 'analysis') {
        if (!data.analysis) {
          // mode declares analysis but field is absent — backend bug, surface it cleanly
          setFileError('Analysis result was incomplete. Please try again.');
          setStatus('idle');
          return;
        }
        sessionStorage.setItem('analysis_result', JSON.stringify(data.analysis));
        sessionStorage.setItem('analysis_truncated', data.truncated ? 'true' : 'false');

        // The credit was already consumed server-side by /api/analyze, and the
        // analysis was persisted there from the normalized result. Nothing to
        // report back — just keep the local remaining count honest so the
        // paywall modal appears at the right moment without a refetch.
        setServerRemaining(prev => (prev === null ? prev : Math.max(0, prev - 1)));

        router.push('/results');
        return;
      }

      // Unknown mode — future-proofing: don't crash silently if backend adds a new mode
      setFileError('Unexpected response from server. Please try again.');
      setStatus('idle');

    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setFileError('Analysis timed out. Please try again — large PDFs occasionally take longer.');
      } else {
        setFileError('Network error. Make sure you are connected and try again.');
      }
      setStatus('idle');
    } finally {
      // Fix 2 — guaranteed cleanup regardless of which path exits the try block.
      // Previously clearTimeout was duplicated in try + catch; a thrown exception
      // in the try block after the fetch resolved would skip the try-side call
      // and leak the timer until it fired and aborted a completed request.
      clearTimeout(abortTimer);
      isAnalyzingRef.current = false;
    }
  };

  const handleClaim = async () => {
    if (!claimEmail.trim()) return;
    setClaimLoading(true);
    setClaimError(null);
    try {
      const res = await fetch('/api/whop/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyerEmail: claimEmail.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (data.ok) {
        setClaimSuccess(true);
        setHasFullAccess(true);
        setServerRemaining(9999);
        setShowClaimBanner(false);
      } else {
        setClaimError(data.error ?? 'No purchase found for that email.');
      }
    } catch {
      setClaimError('Network error. Please try again.');
    } finally {
      setClaimLoading(false);
    }
  };

  // Both buy buttons used to build `${base}?redirect=...` with base defaulting
  // to ''. With the env var unset in production that navigated to the CURRENT
  // page with a query string — the button appeared to do nothing, no sale, no
  // error, nothing in the logs.
  const goToCheckout = (returnPath: string) => {
    const base = process.env.NEXT_PUBLIC_WHOP_CHECKOUT_URL ?? '';
    if (!base) {
      setFileError('Checkout is temporarily unavailable. Please email atomeo.019@gmail.com and we will sort you out.');
      console.error('NEXT_PUBLIC_WHOP_CHECKOUT_URL is not set — checkout cannot open.');
      return;
    }
    const redirect = encodeURIComponent(window.location.origin + returnPath);
    window.location.href = `${base}?redirect=${redirect}`;
  };

  const handleDeleteData = async () => {
    const ok = window.confirm(
      'Delete your stored analysis history? Your scores and roasts are erased permanently. Your account and any purchase stay intact.'
    );
    if (!ok) return;
    setDeletingData(true);
    setHistoryError(null);
    try {
      const res  = await fetch('/api/user/data', { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) setHistory([]);
      else setHistoryError(data.error ?? 'Could not delete your data.');
    } catch {
      setHistoryError('Network error. Please try again.');
    } finally {
      setDeletingData(false);
    }
  };

  const handleLogOut = () => {
    signOut(() => router.push('/'));
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">

      {/* ── Mobile top bar (hidden on desktop) ── */}
      <header className="md:hidden flex items-center justify-between px-5 h-16 border-b border-border">
        <Link href="/" className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-gold" />
          <span className="font-display text-2xl uppercase tracking-wide leading-none pt-0.5">CandidAI</span>
        </Link>
        <button
          onClick={handleLogOut}
          className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Exit
        </button>
      </header>

      {/* ── Sidebar (hidden on mobile) ── */}
      <aside className="hidden md:flex w-64 border-r border-border flex-col">
        <div className="px-6 h-16 flex items-center border-b border-border">
          <Link href="/" className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-gold" />
            <span className="font-display text-2xl uppercase tracking-wide leading-none pt-0.5">CandidAI</span>
          </Link>
        </div>

        <nav className="flex-1 p-4">
          <div className="space-y-1">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-4 py-3 font-mono text-xs uppercase tracking-[0.15em] text-gold border-l-2 border-gold bg-gold/5 transition-colors"
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Link>
            <button disabled className="flex items-center gap-3 px-4 py-3 border-l-2 border-transparent font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground/60 cursor-not-allowed w-full">
              <FileText className="w-4 h-4" />
              My Resumes
            </button>
            <button disabled className="flex items-center gap-3 px-4 py-3 border-l-2 border-transparent font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground/60 cursor-not-allowed w-full">
              <Target className="w-4 h-4" />
              Matches
            </button>
            <button disabled className="flex items-center gap-3 px-4 py-3 border-l-2 border-transparent font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground/60 cursor-not-allowed w-full">
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-border flex items-center gap-3">
          <UserButton />
          <button
            onClick={handleLogOut}
            className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Log Out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-10 md:py-14">
          <div className="mb-8 md:mb-10">
            <h1 className="font-display uppercase text-4xl md:text-5xl leading-[0.95] tracking-tight mb-3">
              Drop your resume.<br /><span className="text-gold">Get roasted.</span>
            </h1>
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
              Tier S to F &middot; Brutal AI roast &middot; Shareable card &middot; Free
            </p>
          </div>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative border border-dashed p-8 md:p-14 transition-colors duration-300 ${
              isDragging
                ? 'border-gold bg-gold/5'
                : 'border-border hover:border-gold/40'
            }`}
          >
            <input
              type="file"
              id="resume-upload"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
              disabled={status === 'analyzing'}
            />

            {!uploadedFile ? (
              <label
                htmlFor="resume-upload"
                className="flex flex-col items-center justify-center cursor-pointer"
              >
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-gold/10 border border-gold/25 flex items-center justify-center mb-5">
                  <Upload className="w-6 h-6 md:w-7 md:h-7 text-gold" />
                </div>
                <h3 className="font-display uppercase text-xl md:text-2xl tracking-tight mb-2 text-center">
                  Drop your resume and find out the truth
                </h3>
                <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                  PDF only &middot; Max 5MB &middot; IT industry
                </p>
              </label>
            ) : (
              <div className="flex items-center justify-between bg-card border border-border p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-gold/10 border border-gold/25 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-gold" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{uploadedFile.name}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {(uploadedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                {status !== 'analyzing' && (
                  <button
                    onClick={() => { setUploadedFile(null); setStatus('idle'); setExtractedPreview(null); }}
                    className="w-8 h-8 hover:bg-background flex items-center justify-center transition-colors flex-shrink-0 ml-2"
                  >
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                )}
              </div>
            )}
          </div>

          {fileError && (
            <p className="mt-3 text-sm text-red-400 text-center">{fileError}</p>
          )}

          {extractedPreview && (
            <div className="mt-4 p-4 bg-green-500/5 border border-green-500/25">
              <p className="text-sm font-semibold text-green-400 mb-2">✓ Resume text extracted — AI scoring coming shortly</p>
              <p className="text-xs text-foreground/60 whitespace-pre-wrap line-clamp-4">{extractedPreview}</p>
              <p className="text-xs text-muted-foreground mt-2">This is a preview of the extracted text. Full analysis will appear here once AI is enabled.</p>
            </div>
          )}

          {/* Fix 5 — status-driven button. `idle` = ready, `analyzing` = locked
               spinner, `done` = Analyze Again (resets to idle so user can retry
               without having to pick a new file). The Analyze button is NEVER
               shown while `done` — that was the bug causing the stale re-click. */}
          {uploadedFile && status === 'idle' && (
            <Button size="lg" className="w-full mt-6" onClick={() => startAnalysis(uploadedFile)}>
              <Flame className="w-4 h-4" />
              Roast My Resume
            </Button>
          )}

          {status === 'analyzing' && (
            <Button size="lg" className="w-full mt-6" disabled>
              <Loader className="w-4 h-4 animate-spin" />
              Roasting your resume...
            </Button>
          )}

          {uploadedFile && status === 'done' && (
            <Button size="lg" variant="outline" className="w-full mt-6" onClick={() => setStatus('idle')}>
              Analyze Again
            </Button>
          )}

          {status === 'analyzing' && (
            <p className="text-center font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground mt-4">
              Running the roast — brutal honesty incoming. Usually under 10 seconds.
            </p>
          )}

          <div className="mt-10 md:mt-14 grid md:grid-cols-2 gap-px bg-border border border-border">
            <div className="bg-background p-6 md:p-7">
              <div className="flex items-center justify-between mb-4">
                <Trophy className="w-5 h-5 text-gold" />
                <span className="font-mono text-[11px] text-muted-foreground tracking-[0.2em]">01</span>
              </div>
              <h3 className="font-display uppercase text-2xl tracking-tight mb-2">Tier S — F</h3>
              <p className="text-foreground/60 text-sm leading-relaxed">
                You get a grade. S is elite. F means rebuild. No participation trophies.
              </p>
            </div>

            <div className="bg-background p-6 md:p-7">
              <div className="flex items-center justify-between mb-4">
                <Flame className="w-5 h-5 text-gold" />
                <span className="font-mono text-[11px] text-muted-foreground tracking-[0.2em]">02</span>
              </div>
              <h3 className="font-display uppercase text-2xl tracking-tight mb-2">Share the Burn</h3>
              <p className="text-foreground/60 text-sm leading-relaxed">
                Get a shareable card for Reels. Post your tier. Let them judge.
              </p>
            </div>
          </div>

          {/* ── Past analyses ──────────────────────────────────────────────
               The privacy policy says scores are stored so users can review
               them. This is where they do that — and where they can erase
               them without emailing support. */}
          {isSignedIn && (
            <section className="mt-10 md:mt-14">
              <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <History className="w-4 h-4 text-gold" />
                  <h2 className="font-display uppercase text-2xl tracking-tight">Past analyses</h2>
                </div>
                {history !== null && history.length > 0 && (
                  <button
                    onClick={handleDeleteData}
                    disabled={deletingData}
                    className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {deletingData ? 'Deleting…' : 'Delete my data'}
                  </button>
                )}
              </div>

              {historyError && (
                <p className="text-sm text-red-400">{historyError}</p>
              )}

              {!historyError && history === null && (
                <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Loading…</p>
              )}

              {!historyError && history !== null && history.length === 0 && (
                <p className="text-foreground/60 text-sm">
                  Nothing here yet. Your analyses will be listed here after your first roast.
                </p>
              )}

              {!historyError && history !== null && history.length > 0 && (
                <ul className="space-y-px bg-border border border-border">
                  {history.map((row) => (
                    <li key={row.id} className="bg-background px-5 py-4 flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
                      <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground w-28 flex-shrink-0">
                        {formatDate(row.createdAt)}
                      </span>
                      {row.tier && (
                        <span className="font-display text-xl leading-none text-gold w-8 flex-shrink-0">{row.tier}</span>
                      )}
                      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-foreground/70 w-24 flex-shrink-0">
                        {row.detectedRole ?? '—'}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground tabular-nums w-24 flex-shrink-0">
                        {row.contentScore ?? '—'} / ATS {row.atsScore ?? '—'}
                      </span>
                      <span className="text-foreground/60 text-sm flex-1 min-w-[200px]">
                        {row.roastHeadline ?? row.topPriority ?? ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </main>

      {/* ── Claim purchase banner (shown when returning from Whop with mismatched email) ── */}
      {showClaimBanner && isSignedIn && !hasFullAccess && !claimSuccess && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-md px-4">
          <div className="bg-card border border-gold/40 p-5 shadow-2xl">
            <p className="text-gold text-sm font-semibold mb-1">Didn&apos;t get access after purchase?</p>
            <p className="text-foreground/60 text-xs mb-3">
              If you paid with a different email, enter it below to claim your access.
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                value={claimEmail}
                onChange={e => { setClaimEmail(e.target.value); setClaimError(null); }}
                placeholder="Email used at Whop checkout"
                className="flex-1 bg-background border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/60 transition-colors"
              />
              <button
                onClick={handleClaim}
                disabled={claimLoading || claimEmail.trim().length < 5}
                className="px-4 py-2 bg-gold hover:bg-gold/90 text-background font-mono text-xs uppercase tracking-[0.15em] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {claimLoading ? '...' : 'Claim'}
              </button>
            </div>
            {claimError && <p className="mt-2 text-red-400 text-xs">{claimError}</p>}
            <button
              onClick={() => setShowClaimBanner(false)}
              className="mt-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── Sign-in gate modal ── */}
      {showSignInGate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-card border border-border p-8 max-w-sm w-full mx-4 text-center shadow-2xl">
            <Flame className="w-8 h-8 text-gold mx-auto mb-4" />
            <h2 className="font-display uppercase text-2xl tracking-tight mb-2">Sign in to continue</h2>
            <p className="text-foreground/60 text-sm mb-6">
              {FREE_PARSE_COPY}, no card required. Sign in to analyse your resume.
            </p>
            <SignIn routing="hash" />
            <button
              onClick={() => setShowSignInGate(false)}
              className="mt-4 font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Paywall modal ── */}
      {showPaywallGate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-card border border-border p-8 max-w-sm w-full mx-4 text-center shadow-2xl">
            <span className="font-display text-4xl text-gold block mb-4">$4.99</span>
            <h2 className="font-display uppercase text-2xl tracking-tight mb-2">You&apos;re out of parses</h2>
            <p className="text-foreground/60 text-sm mb-6">
              Get <span className="text-foreground font-semibold">unlimited parses + cover letter</span> for <span className="text-gold font-semibold">$4.99</span>. One-time, no subscription.
            </p>
            <Button
              className="w-full mb-3"
              onClick={() => goToCheckout('/dashboard?unlocked=true')}
            >
              Unlock everything — $4.99
            </Button>
            <button
              onClick={() => setShowPaywallGate(false)}
              className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
