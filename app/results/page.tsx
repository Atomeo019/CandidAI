'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import {
  CircleAlert as AlertCircle,
  CircleCheck as CheckCircle,
  TrendingUp,
  ArrowLeft,
  Loader as Loader2,
  Zap,
  ShieldAlert,
  Target,
  Brain,
  FileSearch,
  Trophy,
  XCircle,
  BarChart3,
  Briefcase,
  Siren,
  BadgeCheck,
  Lock,
  Send,
  FileText,
  Flame,
} from 'lucide-react';
import type { AnalysisResult, RedFlag, HiringPrediction, ResumeTier } from '@/lib/types';
import { normalizeAnalysisResult } from '@/lib/normalize';
import { toast } from 'sonner';
import { Reveal } from '@/components/landing/Reveal';

// ── Helpers ───────────────────────────────────────────────────────────────────

// Default case is required — getProfileColors must never return undefined.
function getProfileColors(strength: AnalysisResult['profile_strength']) {
  switch (strength) {
    case 'Strong':  return { text: 'text-green-400',  border: 'border-green-500/20',  bg: 'bg-green-500/5'  };
    case 'Good':    return { text: 'text-yellow-400', border: 'border-yellow-500/20', bg: 'bg-yellow-500/5' };
    case 'Average': return { text: 'text-orange-400', border: 'border-orange-500/20', bg: 'bg-orange-500/5' };
    case 'Weak':    return { text: 'text-red-400',    border: 'border-red-500/20',    bg: 'bg-red-500/5'    };
    default:        return { text: 'text-muted-foreground', border: 'border-border', bg: 'bg-card' };
  }
}

function getOutcomeStyle(outcome: HiringPrediction['outcome']) {
  switch (outcome) {
    case 'Strong':   return { text: 'text-green-400',  badge: 'bg-green-500/15 text-green-400 border border-green-500/25'  };
    case 'Possible': return { text: 'text-yellow-400', badge: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/25' };
    case 'Unlikely': return { text: 'text-orange-400', badge: 'bg-orange-500/15 text-orange-400 border border-orange-500/25' };
    case 'No':       return { text: 'text-red-400',    badge: 'bg-red-500/15 text-red-400 border border-red-500/25'      };
    default:         return { text: 'text-foreground/70', badge: 'bg-card text-foreground/70 border border-border' };
  }
}

function getTierLabel(tier: HiringPrediction['competitive_tier']) {
  switch (tier) {
    case 'FAANG':       return 'FAANG-Competitive';
    case 'Top-50':      return 'Top-50 Tech';
    case 'Mid-Market':  return 'Mid-Market Ready';
    case 'Startup-Only': return 'Startup-Viable';
    case 'Not-Ready':   return 'Not Interview-Ready';
  }
}

function getRiskColor(risk: string) {
  switch (risk) {
    case 'Critical': return 'text-red-400';
    case 'High':     return 'text-orange-400';
    case 'Medium':   return 'text-yellow-400';
    default:         return 'text-green-400';
  }
}

function getRedFlagColor(severity: RedFlag['severity']) {
  switch (severity) {
    case 'Critical': return { edge: 'border-l-red-500',    icon: 'text-red-400',    badge: 'text-red-400'    };
    case 'High':     return { edge: 'border-l-orange-500', icon: 'text-orange-400', badge: 'text-orange-400' };
    case 'Medium':   return { edge: 'border-l-yellow-500', icon: 'text-yellow-400', badge: 'text-yellow-400' };
  }
}


function getTierStyle(tier: ResumeTier) {
  switch (tier) {
    case 'S': return { label: 'S', bg: 'bg-gold',        text: 'text-background',  ring: 'ring-gold/50',       accent: 'text-gold',          glow: 'shadow-[0_0_60px_rgba(201,168,76,0.35)]' };
    case 'A': return { label: 'A', bg: 'bg-green-500',   text: 'text-background',  ring: 'ring-green-500/50',  accent: 'text-green-400',     glow: 'shadow-[0_0_60px_rgba(74,222,128,0.25)]' };
    case 'B': return { label: 'B', bg: 'bg-foreground',  text: 'text-background',  ring: 'ring-foreground/30', accent: 'text-foreground',    glow: 'shadow-[0_0_50px_rgba(237,237,237,0.15)]' };
    case 'C': return { label: 'C', bg: 'bg-muted',       text: 'text-foreground',  ring: 'ring-muted/50',      accent: 'text-foreground/80', glow: 'shadow-[0_0_40px_rgba(237,237,237,0.10)]' };
    case 'D': return { label: 'D', bg: 'bg-orange-500',  text: 'text-background',  ring: 'ring-orange-500/50', accent: 'text-orange-400',    glow: 'shadow-[0_0_50px_rgba(249,115,22,0.25)]' };
    case 'F': return { label: 'F', bg: 'bg-destructive', text: 'text-destructive-foreground', ring: 'ring-destructive/50', accent: 'text-red-400', glow: 'shadow-[0_0_60px_rgba(168,50,50,0.35)]' };
  }
}

// ── In-view animation primitives ──────────────────────────────────────────────

function useInView<T extends HTMLElement>(threshold = 0.35) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/** Number that counts up from 0 when it scrolls into view. */
function CountUp({ value, suffix = '', className }: { value: number; suffix?: string; className?: string }) {
  const { ref, inView } = useInView<HTMLSpanElement>(0.6);
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const dur = 1000;
    const tick = (now: number) => {
      const t = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(eased * value));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);
  return (
    <span ref={ref} className={className}>
      {display}
      {suffix}
    </span>
  );
}

/**
 * Prominent animated metric bar — fills with a glowing gradient when scrolled
 * into view. tone 'gold' for brand metrics, 'auto' colors by score value.
 */
function MetricBar({
  label,
  value,
  tone = 'gold',
  strong = false,
}: {
  label: string;
  value: number;
  tone?: 'gold' | 'neutral' | 'auto';
  strong?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const { ref, inView } = useInView<HTMLDivElement>(0.5);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const dur = 1000;
    const tick = (now: number) => {
      const t = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(eased * clamped));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, clamped]);

  const fill =
    tone === 'gold'
      ? 'bg-gradient-to-r from-gold/80 to-[#E8D390] shadow-[0_0_12px_rgba(201,168,76,0.5)]'
      : tone === 'neutral'
        ? 'bg-foreground/60 shadow-[0_0_10px_rgba(237,237,237,0.2)]'
        : clamped >= 70
          ? 'bg-gradient-to-r from-green-600 to-green-400 shadow-[0_0_12px_rgba(74,222,128,0.4)]'
          : clamped >= 45
            ? 'bg-gradient-to-r from-yellow-600 to-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.35)]'
            : 'bg-gradient-to-r from-red-600 to-red-400 shadow-[0_0_12px_rgba(248,113,113,0.4)]';

  const valueColor =
    tone === 'auto'
      ? clamped >= 70
        ? 'text-green-400'
        : clamped >= 45
          ? 'text-yellow-400'
          : 'text-red-400'
      : 'text-foreground';

  return (
    <div ref={ref}>
      <div className="flex justify-between items-baseline mb-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
        <span className={`font-display text-lg leading-none tabular-nums ${valueColor}`}>{display}</span>
      </div>
      <div className={`${strong ? 'h-2' : 'h-1.5'} bg-white/5 border border-white/5 overflow-hidden`}>
        <div
          className={`h-full ${fill} transition-[width] ease-out [transition-duration:1000ms]`}
          style={{ width: inView ? `${clamped}%` : '0%' }}
        />
      </div>
    </div>
  );
}

/** Editorial section header — mono eyebrow + display title, no box. */
function SectionHead({
  icon: Icon,
  eyebrow,
  title,
  hint,
  iconClass = 'text-gold',
}: {
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  hint?: string;
  iconClass?: string;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${iconClass}`} />
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{eyebrow}</span>
      </div>
      <h2 className="font-display uppercase text-3xl md:text-4xl leading-[0.95] tracking-tight">{title}</h2>
      {hint && <p className="mt-2 text-sm text-foreground/50">{hint}</p>}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-muted-foreground text-sm italic">{message}</p>;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ResultsPage() {
  const [analysis, setAnalysis]           = useState<AnalysisResult | null>(null);
  const [progress, setProgress]           = useState(0);
  const [sessionError, setSessionError]   = useState(false);
  const [isTruncated, setIsTruncated]     = useState(false);
  const [showShareCard, setShowShareCard]   = useState(false);

  // Apply Engine state
  const [jdText, setJdText]               = useState('');
  const [applyLoading, setApplyLoading]   = useState(false);
  const [applyPreview, setApplyPreview]   = useState<string | null>(null);
  const [applyError, setApplyError]       = useState<string | null>(null);
  const [hasFullAccess, setHasFullAccess]   = useState(false);

  const router = useRouter();
  const { isSignedIn } = useAuth();

  // Fetch paid status on mount
  useEffect(() => {
    if (!isSignedIn) return;
    fetch('/api/user/usage')
      .then(r => r.json())
      .then(d => setHasFullAccess(d.hasFullAccess ?? false))
      .catch(() => {});
  }, [isSignedIn]);

  useEffect(() => {
    try {
      // 'resume_uploaded' was never set by the dashboard — removed that dead check.
      // We gate on 'analysis_result' only.
      const stored = sessionStorage.getItem('analysis_result');
      if (!stored) { setSessionError(true); return; }

      let parsed: unknown;
      try { parsed = JSON.parse(stored); }
      catch { setSessionError(true); return; }

      // normalizeAnalysisResult on the client is a second defense layer.
      // The server already normalized, but sessionStorage could be tampered with.
      const safe = normalizeAnalysisResult(parsed);
      setAnalysis(safe);
      setIsTruncated(sessionStorage.getItem('analysis_truncated') === 'true');

      // Animate score. final_score is guaranteed [0, 100] after normalization.
      const target = safe.final_score;
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= target) { clearInterval(interval); return target; }
          return Math.min(prev + 2, target); // prevents overshooting
        });
      }, 30);

      return () => clearInterval(interval);
    } catch {
      setSessionError(true);
    }
  }, []);

  // ── Error state ───────────────────────────────────────────────────────────────

  if (sessionError) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-orange-500/10 border border-orange-500/25 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-orange-400" />
          </div>
          <h2 className="font-display uppercase text-3xl tracking-tight mb-3">Session Expired</h2>
          <p className="text-foreground/60 mb-8 leading-relaxed">
            Your results couldn&apos;t be loaded — this usually happens in private browsing or when navigating
            directly to this page. Upload your resume again to get your analysis.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="h-11 px-6 bg-gold text-background font-mono text-xs uppercase tracking-[0.15em] hover:bg-gold/90 transition-colors"
          >
            Go Back &amp; Upload Resume
          </button>
        </div>
      </div>
    );
  }

  // ── Loading state ─────────────────────────────────────────────────────────────

  if (!analysis) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-14 h-14 text-gold animate-spin mx-auto mb-6" />
          <h2 className="font-display uppercase text-3xl tracking-tight mb-2">Loading Results</h2>
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Just a moment...</p>
        </div>
      </div>
    );
  }

  // ── Unlock handler ───────────────────────────────────────────────────────────────
  async function handleUnlock() {
    if (!analysis || jdText.trim().length < 50) return;
    // Store data so /cover-letter can pick it up after redirect
    sessionStorage.setItem('cl_jd', jdText.trim());
    sessionStorage.setItem('cl_analysis', JSON.stringify({
      detected_role:       analysis.detected_role,
      project_analysis:    analysis.project_analysis,
      experience_analysis: analysis.experience_analysis,
      strengths:           analysis.strengths,
      skills_analysis:     analysis.skills_analysis,
    }));

    if (hasFullAccess) {
      router.push('/cover-letter');
      return;
    }

    // Not paid — send them to Whop checkout, returning to /cover-letter after
    // payment. `base` used to default to '' with no guard, so an unset env var
    // navigated to this same page with a query string: the button looked dead
    // and the sale was silently lost.
    const base = process.env.NEXT_PUBLIC_WHOP_CHECKOUT_URL ?? '';
    if (!base) {
      setApplyError('Checkout is temporarily unavailable. Please email atomeo.019@gmail.com and we will sort you out.');
      console.error('NEXT_PUBLIC_WHOP_CHECKOUT_URL is not set — checkout cannot open.');
      return;
    }
    const redirect = encodeURIComponent(window.location.origin + '/cover-letter?unlocked=true');
    window.location.href = `${base}?redirect=${redirect}`;
  }

  // ── Apply Engine handler ───────────────────────────────────────────────────────
  async function generateApplyPreview() {
    if (!analysis || jdText.trim().length < 50) return;
    setApplyLoading(true);
    setApplyPreview(null);
    setApplyError(null);
    try {
      const res = await fetch('/api/apply-preview', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jd: jdText.trim(),
          analysis: {
            detected_role:       analysis.detected_role,
            project_analysis:    analysis.project_analysis,
            experience_analysis: analysis.experience_analysis,
            strengths:           analysis.strengths,
          },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setApplyPreview(data.preview as string);
      } else {
        setApplyError((data.error as string) || 'Generation failed. Try again.');
      }
    } catch {
      setApplyError('Network error. Please try again.');
    } finally {
      setApplyLoading(false);
    }
  }

  // All fields are safe after normalization.
  const profileColors  = getProfileColors(analysis.profile_strength);
  const tierStyle      = getTierStyle(analysis.tier);
  const outcomeStyle   = getOutcomeStyle(analysis.hiring_prediction.outcome);
  const criticalFlags  = analysis.red_flags.filter((f) => f.severity === 'Critical');
  const otherFlags     = analysis.red_flags.filter((f) => f.severity !== 'Critical');
  const hasCritical    = criticalFlags.length > 0;

  const outcomeLabel =
    analysis.hiring_prediction.outcome === 'Strong'   ? 'Strong Candidate'   :
    analysis.hiring_prediction.outcome === 'Possible' ? 'Possible Candidate' :
    analysis.hiring_prediction.outcome === 'Unlikely' ? 'Unlikely to Get Interviews' :
    'Not Interview-Ready';

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── Nav ── */}
      <nav className="border-b border-border sticky top-0 bg-background/85 backdrop-blur-md z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-gold" />
            <span className="font-display text-2xl uppercase tracking-wide leading-none pt-0.5">CandidAI</span>
          </div>
        </div>
      </nav>

      {/* ── VERDICT HERO — the roast, delivered like the landing hero ── */}
      <header className="relative overflow-hidden border-b border-border">
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 55% 45% at 50% 0%, rgba(201,168,76,0.13) 0%, rgba(201,168,76,0.04) 45%, transparent 70%)',
          }}
        />
        <div className="hero-grid !opacity-60" style={{ maskImage: 'radial-gradient(ellipse 60% 55% at 50% 0%, black 0%, transparent 75%)', WebkitMaskImage: 'radial-gradient(ellipse 60% 55% at 50% 0%, black 0%, transparent 75%)' }} />

        <div className="relative max-w-4xl mx-auto px-6 pt-14 pb-16 md:pt-20 md:pb-20 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-8">
            Analysis complete &middot; Evaluated as <span className="text-foreground">{analysis.detected_role}</span>
            {analysis.role_confidence < 60 && (
              <span className="block mt-1 text-yellow-400/80 normal-case tracking-normal">
                (role detected with low confidence — advice may need adjustment)
              </span>
            )}
          </p>

          <div className="flex flex-col items-center gap-3 mb-10">
            <div className={`w-24 h-24 md:w-28 md:h-28 ${tierStyle.bg} ${tierStyle.glow} flex items-center justify-center ring-1 ${tierStyle.ring} ring-offset-8 ring-offset-background`}>
              <span className={`font-display text-6xl md:text-7xl ${tierStyle.text}`}>{analysis.tier}</span>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground mt-2">Resume Tier</span>
          </div>

          <h1 className={`font-display uppercase text-3xl md:text-5xl leading-[1.02] tracking-tight max-w-3xl mx-auto mb-6 ${tierStyle.accent}`}>
            &ldquo;{analysis.roast_headline}&rdquo;
          </h1>

          <p className="text-foreground/60 text-sm md:text-base leading-relaxed max-w-2xl mx-auto mb-10">
            {analysis.roast_body}
          </p>

          <button
            onClick={() => setShowShareCard(true)}
            className="inline-flex items-center gap-2 h-11 px-6 bg-gold text-background font-mono text-xs uppercase tracking-[0.15em] hover:bg-gold/90 hover:-translate-y-0.5 transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            Share The Roast
          </button>
        </div>
      </header>

      {/* ── STATS BAND — the four numbers that matter, seam-grid ── */}
      <section className="border-b border-border">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-px bg-border border-x border-border">
          <div className="bg-background px-6 py-8 text-center group hover:bg-card/60 transition-colors">
            <CountUp value={analysis.final_score} className="font-display text-5xl md:text-6xl text-gold" />
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Final Score / 100</p>
          </div>
          <div className="bg-background px-6 py-8 text-center group hover:bg-card/60 transition-colors">
            <CountUp value={analysis.hiring_prediction.screen_pass_rate} suffix="%" className={`font-display text-5xl md:text-6xl ${outcomeStyle.text}`} />
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">ATS Pass Rate</p>
          </div>
          <div className="bg-background px-6 py-8 text-center group hover:bg-card/60 transition-colors flex flex-col items-center justify-center">
            <p className={`font-display uppercase text-2xl md:text-3xl leading-none ${outcomeStyle.text}`}>{outcomeLabel}</p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Hiring Prediction</p>
          </div>
          <div className="bg-background px-6 py-8 text-center group hover:bg-card/60 transition-colors flex flex-col items-center justify-center">
            <p className="font-display uppercase text-2xl md:text-3xl leading-none text-foreground">{getTierLabel(analysis.hiring_prediction.competitive_tier)}</p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Competitive Tier</p>
          </div>
        </div>
        <div className="max-w-6xl mx-auto border-x border-border">
          <p className={`px-6 py-5 text-center text-sm md:text-base leading-relaxed font-medium ${outcomeStyle.text}`}>
            {analysis.hiring_prediction.verdict}
          </p>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-16 space-y-14 md:space-y-20">

        {/* Truncation warning */}
        {isTruncated && (
          <div className="flex items-start gap-3 p-4 border-l-2 border-l-yellow-500 border border-yellow-500/20 bg-yellow-500/5 !mt-0">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-foreground/70 text-sm">
              <span className="font-semibold text-yellow-400">Large resume detected.</span> Only the first portion was
              analyzed. Keep your resume to 1 page — competitive internship programs prefer it.
            </p>
          </div>
        )}

        {/* Career pivot warning */}
        {analysis.is_career_pivot && (
          <div className="flex items-start gap-3 p-4 border-l-2 border-l-gold border border-gold/20 bg-gold/5 !mt-6">
            <AlertCircle className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-gold text-sm font-semibold mb-1">Career Pivot Detected</p>
              <p className="text-foreground/60 text-sm">
                Your work history doesn&apos;t align with your apparent target role. This is a reframing
                problem, not a polish problem. The advice below targets that gap specifically.
              </p>
            </div>
          </div>
        )}

        {/* ── CRITICAL RED FLAGS — binary rejection triggers shown before the score ── */}
        {hasCritical && (
          <Reveal>
            <section className="border-l-2 border-l-red-500 border border-red-500/25 bg-red-500/5 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-2">
                <Siren className="w-5 h-5 text-red-400" />
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-red-400/80">Automatic Disqualifiers</span>
              </div>
              <h2 className="font-display uppercase text-3xl tracking-tight text-red-400 mb-2">Critical Issues — Fix Before Applying</h2>
              <p className="text-red-400/70 text-sm mb-6">
                These are automatic disqualifiers. Applying before fixing these wastes every application.
              </p>
              <div className="space-y-3">
                {criticalFlags.map((flag, i) => {
                  const colors = getRedFlagColor(flag.severity);
                  return (
                    <div key={i} className={`flex items-start gap-3 p-4 bg-background/60 border border-border border-l-2 ${colors.edge} transition-transform hover:translate-x-1`}>
                      <XCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${colors.icon}`} />
                      <div>
                        <p className={`font-semibold text-sm ${colors.icon}`}>{flag.flag}</p>
                        <p className="text-foreground/50 text-xs mt-1">{flag.impact}</p>
                      </div>
                      <span className={`ml-auto font-mono text-[10px] uppercase tracking-[0.15em] flex-shrink-0 ${colors.badge}`}>
                        {flag.severity}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          </Reveal>
        )}

        {/* ── Score panel + verdict details ── */}
        <div className="grid lg:grid-cols-3 gap-10 lg:gap-14 !mt-12">

          {/* Score panel */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-24 space-y-8">

              {/* Circle */}
              <Reveal>
                <div className="flex flex-col items-center border border-border bg-card/40 px-6 py-10">
                  <div className="relative w-44 h-44 md:w-52 md:h-52">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 192 192">
                      <circle cx="96" cy="96" r="86" stroke="currentColor" strokeWidth="10" fill="none" className="text-white/5" />
                      <circle
                        cx="96" cy="96" r="86"
                        stroke="url(#score-gradient)"
                        strokeWidth="10"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 86}`}
                        strokeDashoffset={`${2 * Math.PI * 86 * (1 - progress / 100)}`}
                        className="transition-all duration-300"
                        style={{ filter: 'drop-shadow(0 0 14px rgba(201,168,76,0.45))' }}
                      />
                      <defs>
                        <linearGradient id="score-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#C9A84C" />
                          <stop offset="100%" stopColor="#E8D390" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-display text-6xl md:text-7xl text-gold leading-none">{progress}</span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-1">/100 Final</span>
                    </div>
                  </div>
                </div>
              </Reveal>

              {/* Aggregate scores */}
              <Reveal delay={80}>
                <div className="border border-border bg-card/40 p-6 space-y-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Score Breakdown</p>
                  <MetricBar label="Content Score" value={analysis.content_score} tone="gold" strong />
                  <MetricBar label="ATS Score"     value={analysis.ats_score}     tone="neutral" strong />
                  <div className="pt-4 border-t border-border">
                    <MetricBar label="Final Score" value={analysis.final_score} tone="gold" strong />
                  </div>
                </div>
              </Reveal>

              {/* Dimension scores */}
              <Reveal delay={140}>
                <div className="border border-border bg-card/40 p-6 space-y-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">6 Dimensions</p>
                  <MetricBar label="Technical Depth"      value={analysis.dimension_scores.technical_depth}      tone="auto" />
                  <MetricBar label="Project Impact"       value={analysis.dimension_scores.project_impact}       tone="auto" />
                  <MetricBar label="Experience Relevance" value={analysis.dimension_scores.experience_relevance} tone="auto" />
                  <MetricBar label="ATS Compatibility"    value={analysis.dimension_scores.ats_compatibility}    tone="auto" />
                  <MetricBar label="Narrative Clarity"    value={analysis.dimension_scores.narrative_clarity}    tone="auto" />
                  <MetricBar label="Completeness"         value={analysis.dimension_scores.completeness}         tone="auto" />
                </div>
              </Reveal>

              {/* Summary */}
              {analysis.summary && (
                <Reveal delay={200}>
                  <div className="border-l-2 border-l-gold pl-5 py-1">
                    <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Recruiter Verdict</p>
                    <p className="text-foreground/70 text-sm leading-relaxed">{analysis.summary}</p>
                  </div>
                </Reveal>
              )}
            </div>
          </div>

          {/* Issues + Action Plan — editorial column, no boxes */}
          <div className="lg:col-span-2 space-y-12 md:space-y-14">

            {/* Top Priority — pulled out explicitly so it doesn't get buried */}
            <Reveal>
              <div className="relative border border-gold/30 bg-gradient-to-br from-gold/10 to-transparent p-6 md:p-7 overflow-hidden">
                <Zap className="absolute -right-4 -bottom-6 w-28 h-28 text-gold/5" />
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-gold" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-gold/80">Top Priority</span>
                </div>
                <p className="font-display uppercase text-2xl md:text-3xl leading-tight tracking-tight">{analysis.top_priority}</p>
              </div>
            </Reveal>

            {/* Other red flags (non-critical) */}
            {otherFlags.length > 0 && (
              <Reveal>
                <section>
                  <SectionHead icon={ShieldAlert} eyebrow="Watch List" title="Additional Flags" iconClass="text-orange-400" />
                  <div className="space-y-px bg-border border border-border">
                    {otherFlags.map((flag, i) => {
                      const colors = getRedFlagColor(flag.severity);
                      return (
                        <div key={i} className={`flex items-start gap-3 p-4 bg-background border-l-2 ${colors.edge} transition-transform hover:translate-x-1`}>
                          <AlertCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${colors.icon}`} />
                          <div className="flex-1">
                            <p className={`text-sm font-medium ${colors.icon}`}>{flag.flag}</p>
                            <p className="text-muted-foreground text-xs mt-0.5">{flag.impact}</p>
                          </div>
                          <span className={`font-mono text-[10px] uppercase tracking-[0.15em] flex-shrink-0 ${colors.badge}`}>
                            {flag.severity}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </Reveal>
            )}

            {/* Issues */}
            <Reveal>
              <section>
                <SectionHead icon={AlertCircle} eyebrow="What's Costing You" title="Issues to Fix" iconClass="text-orange-400" />
                <div className="space-y-px bg-border border border-border">
                  {analysis.issues.length > 0 ? (
                    analysis.issues.map((issue, i) => (
                      <div key={i} className="flex items-start gap-4 p-4 bg-background transition-all hover:translate-x-1 hover:bg-card/60">
                        <span className="font-mono text-[11px] text-orange-400 tracking-[0.1em] flex-shrink-0 mt-0.5">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <p className="text-foreground/70 text-sm">{issue}</p>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 bg-background"><EmptyState message="No major issues detected." /></div>
                  )}
                </div>
              </section>
            </Reveal>

            {/* Action Plan */}
            <Reveal>
              <section>
                <SectionHead
                  icon={TrendingUp}
                  eyebrow="The Fix"
                  title="Action Plan"
                  hint="Ordered by hiring impact — #1 matters most"
                />
                <div className="space-y-px bg-border border border-border">
                  {analysis.action_plan.length > 0 ? (
                    analysis.action_plan.map((action, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-4 p-4 transition-all hover:translate-x-1 ${
                          i === 0 ? 'bg-gold/10 border-l-2 border-l-gold' : 'bg-background hover:bg-card/60 border-l-2 border-l-transparent'
                        }`}
                      >
                        <span className={`font-mono text-[11px] tracking-[0.1em] flex-shrink-0 mt-0.5 ${i === 0 ? 'text-gold' : 'text-muted-foreground'}`}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <p className={`text-sm ${i === 0 ? 'text-foreground' : 'text-foreground/70'}`}>{action}</p>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 bg-background"><EmptyState message="No action items generated." /></div>
                  )}
                </div>
              </section>
            </Reveal>

            {/* Upgrade Insight */}
            <Reveal>
              <div className="border-l-2 border-l-gold pl-6 py-1">
                <div className="flex items-center gap-2 mb-2">
                  <BadgeCheck className="w-4 h-4 text-gold" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Highest-Impact Change</span>
                </div>
                <p className="font-display uppercase text-2xl tracking-tight text-gold mb-2">{analysis.upgrade_insight.action}</p>
                <p className="text-sm text-foreground/60 mb-4">{analysis.upgrade_insight.reason}</p>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gold/10 border border-gold/25">
                  <TrendingUp className="w-4 h-4 text-gold" />
                  <span className="font-mono text-xs text-gold">
                    +{analysis.upgrade_insight.expected_score_increase} pts
                  </span>
                </div>
              </div>
            </Reveal>
          </div>
        </div>

        {/* ── Apply Engine — the CTA card, deliberately boxed ── */}
        <Reveal>
          <section className="relative border border-gold/30 overflow-hidden">
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse 60% 80% at 100% 0%, rgba(201,168,76,0.08) 0%, transparent 60%)' }}
            />
            <div className="relative p-6 md:p-10">
              <div className="flex items-center gap-2 mb-2">
                <Send className="w-4 h-4 text-gold" />
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-gold/80">Cover Letter Engine</span>
              </div>
              <h2 className="font-display uppercase text-3xl md:text-4xl tracking-tight mb-2">Apply Engine</h2>
              <p className="text-foreground/60 text-sm mb-8">Paste a job description &rarr; get the first paragraph of your tailored cover letter</p>

              <div className="space-y-4">
                {/* JD textarea */}
                <div>
                  <label className="block font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground mb-2">
                    Job Description
                  </label>
                  <textarea
                    value={jdText}
                    onChange={(e) => {
                      setJdText(e.target.value);
                      if (applyPreview) { setApplyPreview(null); setApplyError(null); }
                    }}
                    placeholder="Paste the full job description here..."
                    rows={6}
                    className="w-full bg-background/80 border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/60 resize-y transition-colors"
                  />
                  <p className="font-mono text-[11px] text-muted-foreground mt-1.5">
                    {jdText.trim().length < 50
                      ? `${Math.max(0, 50 - jdText.trim().length)} more characters needed`
                      : `${jdText.trim().length} chars — ready`}
                  </p>
                </div>

                {/* Generate button */}
                <button
                  onClick={generateApplyPreview}
                  disabled={applyLoading || jdText.trim().length < 50}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 h-11 px-6 bg-gold text-background font-mono text-xs uppercase tracking-[0.15em] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gold/90 hover:-translate-y-0.5 transition-all"
                >
                  {applyLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating preview…
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      Generate Cover Letter Preview
                    </>
                  )}
                </button>

                {/* Error */}
                {applyError && (
                  <div className="flex items-center gap-2 p-3 border-l-2 border-l-red-500 border border-red-500/20 bg-red-500/5 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {applyError}
                  </div>
                )}

                {/* Preview result */}
                {applyPreview && (
                  <div className="space-y-0 overflow-hidden border border-border">
                    {/* Visible first paragraph */}
                    <div className="bg-background p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-green-400">Opening Paragraph — Tailored to This JD</span>
                      </div>
                      <p className="text-foreground/80 text-sm leading-relaxed">{applyPreview}</p>
                    </div>

                    {/* Blurred "rest of the letter" teaser */}
                    <div className="relative bg-background/60 border-t border-border">
                      {/* Fake blurred content */}
                      <div className="px-5 pt-4 pb-2 blur-sm select-none pointer-events-none" aria-hidden="true">
                        <p className="text-foreground/70 text-sm leading-relaxed mb-3">
                          In my previous role I led the development of a high-throughput data pipeline that processed over 2 million records daily, reducing reporting latency from 4 hours to under 8 minutes. This experience maps directly to the scalability challenges mentioned in your engineering requirements, and I am confident I can bring the same systems-first mindset to your team.
                        </p>
                        <p className="text-foreground/70 text-sm leading-relaxed">
                          Beyond technical execution, I have consistently operated as a cross-functional partner — coordinating with product, design, and stakeholders to ship features that balance engineering rigor with business velocity. I believe the best engineers are translators, and I have spent my career building that muscle.
                        </p>
                      </div>

                      {/* Paywall overlay */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-background/70 to-background/95 px-6 py-6">
                        <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center mb-3">
                          <Lock className="w-5 h-5 text-gold" />
                        </div>
                        <p className="text-foreground font-semibold text-center mb-1">Get your full tailored cover letter</p>
                        <p className="text-foreground/60 text-sm text-center mb-4">3 complete paragraphs, personalized to this job description.</p>
                        <button
                          onClick={handleUnlock}
                          disabled={jdText.trim().length < 50}
                          className="h-11 px-6 bg-gold text-background font-mono text-xs uppercase tracking-[0.15em] hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {hasFullAccess ? 'Generate Full Cover Letter →' : 'Unlock Full Cover Letter — $4.99'}
                        </button>
                        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground mt-3">{hasFullAccess ? 'Included in your plan' : 'One-time · no subscription'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </Reveal>

        {/* ── ATS Breakdown ── */}
        <Reveal>
          <section>
            <SectionHead
              icon={FileSearch}
              eyebrow="The Machine's Read"
              title="ATS Analysis"
              hint="How your resume survives automated filtering"
            />
            <div className="grid grid-cols-3 gap-px bg-border border border-border mb-6">
              <div className="bg-background p-5 text-center">
                <p className={`font-display text-3xl md:text-4xl ${getRiskColor(analysis.ats_breakdown.parsing_risk)}`}>{analysis.ats_breakdown.parsing_risk}</p>
                <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Parsing Risk</p>
              </div>
              <div className="bg-background p-5 text-center">
                <p className="font-display text-3xl md:text-4xl text-foreground">{analysis.ats_breakdown.keyword_density}</p>
                <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Keyword Density</p>
              </div>
              <div className="bg-background p-5 text-center">
                <CountUp value={analysis.ats_score} className="font-display text-3xl md:text-4xl text-gold" />
                <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">ATS Score / 100</p>
              </div>
            </div>
            <div className="border-l-2 border-l-gold pl-5 py-1 mb-8">
              <p className="text-foreground/80 text-sm font-medium">{analysis.ats_breakdown.ats_verdict}</p>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              {analysis.ats_breakdown.formatting_issues.length > 0 && (
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground mb-3">Formatting Issues</p>
                  <div className="space-y-2">
                    {analysis.ats_breakdown.formatting_issues.map((issue, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-orange-400">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>{issue}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {analysis.ats_breakdown.missing_keywords.length > 0 && (
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground mb-3">Missing Keywords</p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.ats_breakdown.missing_keywords.map((kw, i) => (
                      <span key={i} className="px-2.5 py-1 font-mono text-xs bg-card border border-border text-foreground/60 hover:border-gold/40 hover:text-foreground transition-colors">{kw}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        </Reveal>

        {/* ── Skills Analysis ── */}
        <Reveal>
          <section>
            <SectionHead icon={Brain} eyebrow="Claimed vs Proven" title="Skills Analysis" />
            <div className="grid md:grid-cols-3 gap-px bg-border border border-border">
              <div className="bg-background p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="w-4 h-4 text-green-400" />
                  <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-green-400">Demonstrated</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {analysis.skills_analysis.strong_skills.length > 0 ? (
                    analysis.skills_analysis.strong_skills.map((s, i) => (
                      <span key={i} className="px-2.5 py-1 font-mono text-xs bg-green-500/5 border border-green-500/25 text-green-400">{s}</span>
                    ))
                  ) : <EmptyState message="None detected" />}
                </div>
              </div>
              <div className="bg-background p-6">
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle className="w-4 h-4 text-yellow-400" />
                  <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-yellow-400">Listed, Not Proven</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {analysis.skills_analysis.weak_skills.length > 0 ? (
                    analysis.skills_analysis.weak_skills.map((s, i) => (
                      <span key={i} className="px-2.5 py-1 font-mono text-xs bg-yellow-500/5 border border-yellow-500/25 text-yellow-400">{s}</span>
                    ))
                  ) : <EmptyState message="None detected" />}
                </div>
              </div>
              <div className="bg-background p-6">
                <div className="flex items-center gap-2 mb-4">
                  <XCircle className="w-4 h-4 text-red-400" />
                  <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-red-400">Missing</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {analysis.skills_analysis.missing_skills.length > 0 ? (
                    analysis.skills_analysis.missing_skills.map((s, i) => (
                      <span key={i} className="px-2.5 py-1 font-mono text-xs bg-red-500/5 border border-red-500/25 text-red-400">{s}</span>
                    ))
                  ) : <EmptyState message="None detected" />}
                </div>
              </div>
            </div>
          </section>
        </Reveal>

        {/* ── Project & Experience Analysis ── */}
        <Reveal>
          <div className="grid md:grid-cols-2 gap-px bg-border border border-border">
            <div className="bg-background p-6 md:p-8">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-gold" />
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Projects</span>
              </div>
              <h2 className="font-display uppercase text-2xl tracking-tight mb-3">Project Analysis</h2>
              <p className="text-foreground/70 text-sm leading-relaxed">{analysis.project_analysis}</p>
            </div>
            <div className="bg-background p-6 md:p-8">
              <div className="flex items-center gap-2 mb-3">
                <Briefcase className="w-4 h-4 text-gold" />
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Experience</span>
              </div>
              <h2 className="font-display uppercase text-2xl tracking-tight mb-3">Experience Analysis</h2>
              <p className="text-foreground/70 text-sm leading-relaxed">{analysis.experience_analysis}</p>
            </div>
          </div>
        </Reveal>

        {/* ── Competitive Position ── */}
        {analysis.competitive_position && (
          <Reveal>
            <section className="text-center max-w-3xl mx-auto">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Target className="w-4 h-4 text-gold" />
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Competitive Position</span>
              </div>
              <h2 className="font-display uppercase text-3xl md:text-4xl tracking-tight mb-5">Where You Stand</h2>
              <p className="text-foreground/70 leading-relaxed">{analysis.competitive_position}</p>
            </section>
          </Reveal>
        )}

        {/* ── Strengths ── */}
        {analysis.strengths.length > 0 && (
          <Reveal>
            <section>
              <SectionHead icon={CheckCircle} eyebrow="Keep These" title="What's Working" iconClass="text-green-400" />
              <div className="space-y-px bg-border border border-border">
                {analysis.strengths.map((strength, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 bg-background border-l-2 border-l-green-500/60 transition-transform hover:translate-x-1">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <p className="text-foreground/70 text-sm">{strength}</p>
                  </div>
                ))}
              </div>
            </section>
          </Reveal>
        )}


        {/* ── SHARE CARD OVERLAY — 9:16, screenshot-ready ── */}
        {showShareCard && (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowShareCard(false)}
          >
            <div className="flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
              {/* The card itself — 9:16 at 360×640, scale down on small screens */}
              <div
                id="share-card"
                className="relative overflow-hidden border border-border shadow-2xl"
                style={{ width: 360, height: 640, background: '#0D0D0D' }}
              >
                {/* Background accent */}
                <div
                  className="absolute inset-0 opacity-25"
                  style={{ background: 'radial-gradient(ellipse at 50% 0%, #C9A84C 0%, transparent 65%)' }}
                />

                {/* Top branding */}
                <div className="absolute top-6 left-6 right-6 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-gold" />
                    <span className="font-display text-lg uppercase tracking-wide leading-none pt-0.5 text-foreground">CandidAI</span>
                  </div>
                  <span className="font-mono text-[9px] text-muted-foreground uppercase tracking-[0.2em]">{analysis.detected_role}</span>
                </div>

                {/* Tier badge — centre */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[70%] flex flex-col items-center gap-3">
                  <div className={`w-32 h-32 ${tierStyle.bg} flex items-center justify-center ring-1 ${tierStyle.ring} ring-offset-8 ring-offset-[#0D0D0D] shadow-2xl`}>
                    <span className={`font-display text-8xl ${tierStyle.text}`}>{analysis.tier}</span>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Resume Tier</span>
                </div>

                {/* Roast headline */}
                <div className="absolute left-6 right-6" style={{ bottom: 200 }}>
                  <p className={`font-display uppercase text-xl leading-tight text-center ${tierStyle.accent}`}>
                    &ldquo;{analysis.roast_headline}&rdquo;
                  </p>
                </div>

                {/* Score + outcome pill */}
                <div className="absolute bottom-20 left-6 right-6 flex items-center justify-between">
                  <div className="text-center">
                    <p className="font-display text-4xl text-foreground">{analysis.final_score}</p>
                    <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-[0.2em]">Score</p>
                  </div>
                  <div className={`px-4 py-2 font-mono text-xs uppercase tracking-[0.1em] ${outcomeStyle.badge}`}>
                    {analysis.hiring_prediction.outcome}
                  </div>
                  <div className="text-center">
                    <p className="font-display text-4xl text-foreground">{analysis.hiring_prediction.screen_pass_rate}%</p>
                    <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-[0.2em]">ATS Pass</p>
                  </div>
                </div>

                {/* Bottom CTA */}
                <div className="absolute bottom-6 left-6 right-6 text-center">
                  <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-[0.15em]">Get your resume roasted at</p>
                  <p className="text-foreground text-sm font-bold">
                    {typeof window !== 'undefined' ? window.location.hostname : 'candidai.app'}
                  </p>
                </div>
              </div>

              {/* Action buttons under card */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowShareCard(false)}
                  className="h-10 px-5 border border-border text-foreground/70 font-mono text-xs uppercase tracking-[0.15em] hover:border-gold hover:text-gold transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={async () => {
                    const url = window.location.origin + '/dashboard';
                    const shareData = {
                      title: `I got a Tier ${analysis.tier} on CandidAI`,
                      text: `"${analysis.roast_headline}" — ${analysis.final_score}/100. Get your resume roasted:`,
                      url,
                    };
                    if (navigator.share && navigator.canShare?.(shareData)) {
                      try { await navigator.share(shareData); } catch { /* user dismissed */ }
                    } else {
                      await navigator.clipboard.writeText(`${shareData.text} ${url}`);
                      toast.success('Copied to clipboard! Paste it anywhere.');
                    }
                  }}
                  className="h-10 px-5 bg-gold text-background font-mono text-xs uppercase tracking-[0.15em] hover:bg-gold/90 transition-colors"
                >
                  Share
                </button>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground/70">Tip: use your phone&rsquo;s screenshot for best quality</p>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
