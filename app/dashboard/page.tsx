'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useClerk, UserButton, useAuth, SignIn } from '@clerk/nextjs';
import type { APIResponse } from '@/lib/types';
import Link from 'next/link';
import {
  Sparkles,
  LayoutDashboard,
  FileText,
  Target,
  Settings,
  Upload,
  LogOut,
  X,
  Loader,
  Flame,
  Trophy
} from 'lucide-react';

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

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

  // Parse gate state
  const [localParseCount, setLocalParseCount] = useState(0);
  const [serverRemaining, setServerRemaining] = useState<number | null>(null);
  const [hasFullAccess, setHasFullAccess] = useState(false);
  const [showSignInGate, setShowSignInGate] = useState(false);
  const [showPaywallGate, setShowPaywallGate] = useState(false);
  const [showClaimBanner, setShowClaimBanner] = useState(false);
  const [claimEmail, setClaimEmail] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState(false);

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
    const local = parseInt(localStorage.getItem('candidai_parse_count') ?? '0', 10);
    setLocalParseCount(local);

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

        // Increment parse counts
        const newLocal = localParseCount + 1;
        localStorage.setItem('candidai_parse_count', newLocal.toString());
        setLocalParseCount(newLocal);

        if (isSignedIn) {
          fetch('/api/user/increment', { method: 'POST' }).catch(() => {});
          fetch('/api/analyses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ analysis: data.analysis }),
          }).catch(() => {});
        }

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

  const handleLogOut = () => {
    signOut(() => router.push('/'));
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row">

      {/* ── Mobile top bar (hidden on desktop) ── */}
      <header className="md:hidden flex items-center justify-between px-4 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-purple-500" />
          <span className="text-lg font-bold gradient-text">CandidAI</span>
        </div>
        <button
          onClick={handleLogOut}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
        >
          <LogOut className="w-4 h-4" />
          Exit
        </button>
      </header>

      {/* ── Sidebar (hidden on mobile) ── */}
      <aside className="hidden md:flex w-64 border-r border-slate-800 flex-col">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-purple-500" />
            <span className="text-xl font-bold gradient-text">CandidAI</span>
          </div>
        </div>

        <nav className="flex-1 p-4">
          <div className="space-y-1">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-4 py-3 rounded-lg bg-purple-600/10 text-purple-400 font-medium transition-colors"
            >
              <LayoutDashboard className="w-5 h-5" />
              Dashboard
            </Link>
            <button disabled className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-600 cursor-not-allowed w-full">
              <FileText className="w-5 h-5" />
              My Resumes
            </button>
            <button disabled className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-600 cursor-not-allowed w-full">
              <Target className="w-5 h-5" />
              Matches
            </button>
            <button disabled className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-600 cursor-not-allowed w-full">
              <Settings className="w-5 h-5" />
              Settings
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-800 flex items-center gap-3">
          <UserButton />
          <button
            onClick={handleLogOut}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            Log Out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-12">
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-4xl font-bold mb-2">Drop Your Resume.<br /><span className="gradient-text">Get Roasted.</span></h1>
            <p className="text-slate-400 text-base md:text-lg">
              Tier S to F &nbsp;·&nbsp; Brutal AI roast &nbsp;·&nbsp; Shareable card. Free.
            </p>
          </div>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-2xl p-8 md:p-12 transition-all ${
              isDragging
                ? 'border-purple-500 bg-purple-500/5'
                : 'border-slate-700 hover:border-slate-600'
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
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4">
                  <Upload className="w-7 h-7 md:w-8 md:h-8 text-purple-400" />
                </div>
                <h3 className="text-base md:text-xl font-semibold mb-2 text-center">
                  Drop your resume and find out the truth
                </h3>
                <p className="text-slate-400 text-sm">PDF only &nbsp;·&nbsp; Max 10MB &nbsp;·&nbsp; IT industry</p>
              </label>
            ) : (
              <div className="flex items-center justify-between bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{uploadedFile.name}</p>
                    <p className="text-sm text-slate-400">
                      {(uploadedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                {status !== 'analyzing' && (
                  <button
                    onClick={() => { setUploadedFile(null); setStatus('idle'); setExtractedPreview(null); }}
                    className="w-8 h-8 rounded-full hover:bg-slate-700 flex items-center justify-center transition-colors flex-shrink-0 ml-2"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                )}
              </div>
            )}
          </div>

          {fileError && (
            <p className="mt-3 text-sm text-red-400 text-center">{fileError}</p>
          )}

          {extractedPreview && (
            <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
              <p className="text-sm font-semibold text-green-400 mb-2">✓ Resume text extracted — AI scoring coming shortly</p>
              <p className="text-xs text-slate-400 whitespace-pre-wrap line-clamp-4">{extractedPreview}</p>
              <p className="text-xs text-slate-500 mt-2">This is a preview of the extracted text. Full analysis will appear here once AI is enabled.</p>
            </div>
          )}

          {/* Fix 5 — status-driven button. `idle` = ready, `analyzing` = locked
               spinner, `done` = Analyze Again (resets to idle so user can retry
               without having to pick a new file). The Analyze button is NEVER
               shown while `done` — that was the bug causing the stale re-click. */}
          {uploadedFile && status === 'idle' && (
            <button
              onClick={() => startAnalysis(uploadedFile)}
              className="w-full mt-6 py-4 rounded-lg gradient-purple text-white font-semibold text-lg hover:opacity-90 transition-opacity shadow-lg shadow-purple-500/30 flex items-center justify-center gap-3"
            >
              <Flame className="w-5 h-5" />
              Roast My Resume
            </button>
          )}

          {status === 'analyzing' && (
            <button
              disabled
              className="w-full mt-6 py-4 rounded-lg gradient-purple text-white font-semibold text-lg opacity-60 cursor-not-allowed flex items-center justify-center gap-3"
            >
              <Loader className="w-5 h-5 animate-spin" />
              Roasting your resume...
            </button>
          )}

          {uploadedFile && status === 'done' && (
            <button
              onClick={() => setStatus('idle')}
              className="w-full mt-6 py-4 rounded-lg border border-purple-500/40 text-purple-400 font-semibold text-lg hover:bg-purple-500/10 transition-colors flex items-center justify-center gap-3"
            >
              Analyze Again
            </button>
          )}

          {status === 'analyzing' && (
            <p className="text-center text-slate-400 text-sm mt-3">
              Running the roast — brutal honesty incoming. Usually under 10 seconds.
            </p>
          )}

          <div className="mt-8 md:mt-12 grid md:grid-cols-2 gap-4 md:gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 md:p-6">
              <div className="w-12 h-12 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4">
                <Trophy className="w-6 h-6 text-yellow-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Tier S — F</h3>
              <p className="text-slate-400 text-sm">
                You get a grade. S is elite. F means rebuild. No participation trophies.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 md:p-6">
              <div className="w-12 h-12 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4">
                <Flame className="w-6 h-6 text-orange-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Share the Burn</h3>
              <p className="text-slate-400 text-sm">
                Get a shareable card for Reels. Post your tier. Let them judge.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* ── Claim purchase banner (shown when returning from Whop with mismatched email) ── */}
      {showClaimBanner && isSignedIn && !hasFullAccess && !claimSuccess && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-md mx-4">
          <div className="bg-slate-900 border border-yellow-500/40 rounded-2xl p-5 shadow-2xl">
            <p className="text-yellow-300 text-sm font-semibold mb-1">Didn&apos;t get access after purchase?</p>
            <p className="text-slate-400 text-xs mb-3">
              If you paid with a different email, enter it below to claim your access.
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                value={claimEmail}
                onChange={e => { setClaimEmail(e.target.value); setClaimError(null); }}
                placeholder="Email used at Whop checkout"
                className="flex-1 rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/40"
              />
              <button
                onClick={handleClaim}
                disabled={claimLoading || claimEmail.trim().length < 5}
                className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {claimLoading ? '...' : 'Claim'}
              </button>
            </div>
            {claimError && <p className="mt-2 text-red-400 text-xs">{claimError}</p>}
            <button
              onClick={() => setShowClaimBanner(false)}
              className="mt-2 text-slate-500 hover:text-slate-400 text-xs transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── Sign-in gate modal ── */}
      {showSignInGate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl">
            <div className="text-4xl mb-4">🔥</div>
            <h2 className="text-xl font-bold text-white mb-2">Sign in to continue</h2>
            <p className="text-slate-400 text-sm mb-6">
              You&apos;ve used your free parse. Sign in with Google to get 4 more free parses.
            </p>
            <SignIn routing="hash" />
            <button
              onClick={() => setShowSignInGate(false)}
              className="mt-4 text-slate-500 hover:text-slate-300 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Paywall modal ── */}
      {showPaywallGate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl">
            <div className="text-4xl mb-4">💳</div>
            <h2 className="text-xl font-bold text-white mb-2">You&apos;re out of parses</h2>
            <p className="text-slate-400 text-sm mb-6">
              Get <span className="text-white font-semibold">unlimited parses + cover letter</span> for <span className="text-white font-semibold">$4.99</span>. One-time, no subscription.
            </p>
            <button
              onClick={() => {
                const base = process.env.NEXT_PUBLIC_WHOP_CHECKOUT_URL ?? '';
                const redirect = encodeURIComponent(window.location.origin + '/dashboard?unlocked=true');
                window.location.href = `${base}?redirect=${redirect}`;
              }}
              className="w-full py-3 px-6 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-colors mb-3"
            >
              Unlock everything — $4.99
            </button>
            <button
              onClick={() => setShowPaywallGate(false)}
              className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
