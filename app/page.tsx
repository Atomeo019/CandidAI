import Link from 'next/link';
import { Flame, ArrowRight, Trophy, Share2, Check, Quote, ArrowDown } from 'lucide-react';
import { FREE_PARSE_LIMIT, FREE_PARSE_COPY } from '@/lib/constants';
import { Button } from '@/components/brand/Button';
import { Card } from '@/components/brand/Card';
import { TierBadge, type Tier } from '@/components/brand/TierBadge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { Nav } from '@/components/landing/Nav';
import { HeroPipeline } from '@/components/landing/HeroPipeline';
import { HeroBackdrop } from '@/components/landing/HeroBackdrop';
import { Reveal } from '@/components/landing/Reveal';
import { RoastMarquee } from '@/components/landing/RoastMarquee';
import { TierStrip } from '@/components/landing/TierStrip';
import { AnimatedStatBar } from '@/components/landing/AnimatedStatBar';

const LARGE_VERDICTS = [
  {
    role: 'Backend Engineer (Intern)',
    tier: 'B' as Tier,
    content: 61,
    ats: 74,
    roast: 'Solid bones, buried under bullet points that describe duties instead of outcomes.',
  },
  {
    role: 'Frontend Developer',
    tier: 'D' as Tier,
    content: 38,
    ats: 52,
    roast: 'Six internships listed as "exposure to." Recruiters read that as zero ownership.',
  },
];

const COMPACT_VERDICTS = [
  {
    role: 'Data Analyst',
    tier: 'C' as Tier,
    content: 45,
    roast: 'Skills section reads like a keyword dump with no proof attached.',
  },
  {
    role: 'DevOps Engineer',
    tier: 'A' as Tier,
    content: 82,
    roast: 'Rare: quantified infra work. This is what recruiters actually skim for.',
  },
];

const FEATURES = [
  {
    icon: Trophy,
    title: 'Tier S To F',
    body: 'Graded like a game. Most resumes land at C and call it a B.',
  },
  {
    icon: Flame,
    title: 'The Roast',
    body: 'Reads your resume like your harshest interviewer. Names the line costing you interviews.',
  },
  {
    icon: Share2,
    title: 'Share The Burn',
    body: 'A vertical card built for the feed. Post your tier. Let them judge.',
  },
];

const FAQS = [
  {
    q: 'Is this actually free?',
    a: 'Yes. Your first 3 resume analyses are free, no card required. After that it’s a one-time $4.99 to unlock unlimited parses and the cover letter generator.',
  },
  {
    q: 'What counts as an IT resume?',
    a: 'Software, data, DevOps, IT support, cybersecurity, QA — anything a recruiter would screen through an ATS built for tech roles. Non-tech resumes get a low-confidence flag instead of a wrong verdict.',
  },
  {
    q: 'Do you store my resume?',
    a: 'No. We never store or log your resume text — only the scores and tier generated from it. See our Privacy Policy for specifics.',
  },
  {
    q: 'How harsh is "brutal"?',
    a: 'Harsh enough to be useful. We say what a recruiter thinks but won’t tell you to your face. If that’s not what you want, this isn’t the tool for you.',
  },
  {
    q: 'What’s the $4.99 for?',
    a: 'Unlimited resume parses, plus a cover letter generator tailored to any job description you paste in. One-time payment, not a subscription.',
  },
];

function TwoToneTitle({ muted, bold }: { muted: string; bold: string }) {
  return (
    <h2 className="font-display uppercase text-4xl md:text-6xl leading-[0.95] tracking-tight">
      <span className="text-muted-foreground">{muted}</span>
      <br />
      <span className="text-foreground">{bold}</span>
    </h2>
  );
}

/**
 * A row in the editorial rail frame: hairline top border with "+" markers
 * at the rail intersections, mono section number in the header.
 */
function SectionFrame({
  id,
  number,
  eyebrow,
  children,
  className,
  first = false,
}: {
  id?: string;
  number?: string;
  eyebrow?: string;
  children: React.ReactNode;
  className?: string;
  first?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn('relative scroll-mt-16', !first && 'border-t border-border', className)}
    >
      {!first && (
        <>
          <span className="rail-plus left-0 -translate-x-1/2" aria-hidden="true">+</span>
          <span className="rail-plus right-0 translate-x-1/2" aria-hidden="true">+</span>
        </>
      )}
      {(number || eyebrow) && (
        <p className="absolute top-8 left-6 md:left-10 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground/70">
          {number && <span className="text-gold/70">{number}</span>}
          {number && eyebrow && <span className="mx-2 text-muted-foreground/40">/</span>}
          {eyebrow}
        </p>
      )}
      {children}
    </section>
  );
}

function VerdictCard({
  role,
  tier,
  content,
  ats,
  roast,
  compact = false,
}: {
  role: string;
  tier: Tier;
  content: number;
  ats?: number;
  roast: string;
  compact?: boolean;
}) {
  return (
    <Card
      className={`group transition-all duration-500 hover:-translate-y-1.5 hover:border-gold/40 hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.6)] ${
        compact
          ? 'p-5 w-[280px] shrink-0 snap-start'
          : 'p-6 md:p-8 w-[340px] md:w-[420px] shrink-0 snap-start'
      }`}
    >
      <div className="flex items-start justify-between mb-5 gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground mb-1">
            {role}
          </p>
          <p className="text-foreground text-sm leading-relaxed">{roast}</p>
        </div>
        <TierBadge
          tier={tier}
          size="sm"
          className="flex-shrink-0 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3"
        />
      </div>
      <div className="space-y-3">
        <AnimatedStatBar label="Content Score" value={content} />
        {ats !== undefined && <AnimatedStatBar label="ATS Score" value={ats} />}
      </div>
    </Card>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />

      <main>
        {/* ---- Hero: rounded card with golden arc + verdict pipeline ---- */}
        <section className="px-3 md:px-4 pt-20 md:pt-[84px]">
          <div className="relative max-w-6xl mx-auto rounded-2xl md:rounded-3xl border border-border overflow-hidden bg-[#0B0B0B]">
            <HeroBackdrop />

            <div className="relative z-10 flex flex-col items-center text-center px-6 pt-16 pb-20 md:pt-24 md:pb-24">
              <div className="hero-enter inline-flex items-center gap-2.5 mb-10">
                <span className="relative flex size-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-60" />
                  <span className="relative inline-flex rounded-full size-2 bg-gold" />
                </span>
                <span className="font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  Free roast &middot; IT resumes only
                </span>
              </div>

              <div className="hero-enter w-full" style={{ animationDelay: '120ms' }}>
                <HeroPipeline />
              </div>

              <h1
                className="hero-enter font-display uppercase text-5xl md:text-7xl leading-[0.95] tracking-tight mt-12 md:mt-14 mb-6 max-w-3xl"
                style={{ animationDelay: '240ms' }}
              >
                Your resume has a tier.
                <br />
                <span className="bg-gradient-to-r from-foreground via-foreground to-gold bg-clip-text text-transparent">
                  Find out if it&rsquo;s S or F.
                </span>
              </h1>

              <p
                className="hero-enter text-foreground/60 text-lg mb-10 max-w-xl mx-auto leading-relaxed"
                style={{ animationDelay: '360ms' }}
              >
                Graded like a recruiter grades it &mdash; S to F. No tips. No encouragement.
                Just the data.
              </p>

              <div
                className="hero-enter flex flex-col sm:flex-row items-center gap-5"
                style={{ animationDelay: '480ms' }}
              >
                <Button asChild size="lg">
                  <Link href="/dashboard">
                    <Flame className="w-4 h-4" />
                    Get Roasted &mdash; Free
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
                <a
                  href="#verdicts"
                  className="group inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors"
                >
                  See real verdicts
                  <ArrowDown className="w-3.5 h-3.5 transition-transform group-hover:translate-y-0.5" />
                </a>
              </div>

              <p
                className="hero-enter mt-8 font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground/70"
                style={{ animationDelay: '600ms' }}
              >
                {FREE_PARSE_COPY} &middot; No card &middot; Resumes never stored
              </p>
            </div>
          </div>
        </section>

        {/* ---- Roast ticker ---- */}
        <div className="mt-16 md:mt-24">
          <RoastMarquee />
        </div>

        {/* ---- Editorial rail frame: every section is a row in one composition ---- */}
        <div className="max-w-6xl mx-auto md:border-x border-border">

          {/* 01 — Tier system (interactive) */}
          <SectionFrame first number="01" eyebrow="The grading scale">
            <div className="max-w-4xl mx-auto px-6 py-24 md:py-32">
              <Reveal className="text-center mb-14">
                <TwoToneTitle muted="Six tiers." bold="One honest answer." />
              </Reveal>
              <Reveal delay={100}>
                <TierStrip />
              </Reveal>
            </div>
          </SectionFrame>

          {/* 02 — Showcase: real verdict cards */}
          <SectionFrame id="verdicts" number="02" eyebrow="The evidence">
            <div className="py-24 md:py-32">
              <Reveal className="max-w-4xl mx-auto px-6 mb-12 text-center">
                <TwoToneTitle muted="Real resumes." bold="Real roasts." />
                <p className="mt-5 text-foreground/60 max-w-md mx-auto">
                  Anonymized. Every field below is exactly what the tool generates &mdash; nothing
                  staged.
                </p>
              </Reveal>
              <Reveal delay={100}>
                <div className="flex gap-5 overflow-x-auto snap-x snap-mandatory px-6 md:px-10 pb-4 scrollbar-none">
                  {LARGE_VERDICTS.map((v) => (
                    <VerdictCard key={v.role} {...v} />
                  ))}
                  <div className="flex flex-col gap-5 shrink-0">
                    {COMPACT_VERDICTS.map((v) => (
                      <VerdictCard key={v.role} {...v} compact />
                    ))}
                  </div>
                </div>
              </Reveal>
            </div>
          </SectionFrame>

          {/* 03 — Features */}
          <SectionFrame id="features" number="03" eyebrow="What you get">
            <div className="max-w-4xl mx-auto px-6 py-24 md:py-32">
              <Reveal className="mb-16 text-center">
                <TwoToneTitle muted="What you get." bold="No participation trophies." />
              </Reveal>
              <div className="grid md:grid-cols-3 gap-10">
                {FEATURES.map(({ icon: Icon, title, body }, i) => (
                  <Reveal key={title} delay={i * 130}>
                    <div className="group h-full border border-transparent hover:border-border hover:bg-card/40 transition-all duration-500 p-5 -m-5 md:m-0 md:p-6">
                      <div className="flex items-center justify-between mb-5">
                        <Icon className="w-6 h-6 text-gold transition-transform duration-500 group-hover:-translate-y-1 group-hover:scale-110" />
                        <span className="font-mono text-[11px] text-muted-foreground tracking-[0.2em]">
                          0{i + 1}
                        </span>
                      </div>
                      <h3 className="font-display text-2xl uppercase mb-2">{title}</h3>
                      <p className="text-foreground/60 text-sm leading-relaxed">{body}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </SectionFrame>

          {/* 04 — Pricing */}
          <SectionFrame id="pricing" number="04" eyebrow="The damage">
            <div className="max-w-4xl mx-auto px-6 py-24 md:py-32">
              <Reveal className="mb-16 text-center">
                <TwoToneTitle muted="Simple pricing." bold="No subscription." />
              </Reveal>
              <Reveal delay={100}>
                <div className="grid md:grid-cols-2 gap-px bg-border border border-border">
                  <div className="bg-background p-8 md:p-10 flex flex-col transition-colors duration-500 hover:bg-card/60">
                    <h3 className="font-display text-3xl uppercase mb-1">Free</h3>
                    <p className="text-foreground/60 text-sm mb-6">
                      Enough to know where you stand.
                    </p>
                    <p className="font-display text-5xl uppercase mb-6">$0</p>
                    <ul className="space-y-3 mb-8 flex-1">
                      <li className="flex items-start gap-2.5 text-sm text-foreground/60">
                        <Check className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                        {FREE_PARSE_LIMIT} free resume analyses
                      </li>
                      <li className="flex items-start gap-2.5 text-sm text-foreground/60">
                        <Check className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                        Full tier, score &amp; roast
                      </li>
                      <li className="flex items-start gap-2.5 text-sm text-foreground/60">
                        <Check className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                        Shareable verdict card
                      </li>
                    </ul>
                    <Button asChild variant="outline">
                      <Link href="/dashboard">Get Roasted</Link>
                    </Button>
                  </div>

                  <div className="relative bg-background p-8 md:p-10 flex flex-col transition-colors duration-500 hover:bg-card/60">
                    <span className="absolute top-0 right-0 font-mono text-[10px] uppercase tracking-[0.2em] text-background bg-gold px-3 py-1.5">
                      One-Time
                    </span>
                    <h3 className="font-display text-3xl uppercase mb-1 text-gold">Unlock</h3>
                    <p className="text-foreground/60 text-sm mb-6">
                      For when you&rsquo;re actually applying.
                    </p>
                    <p className="font-display text-5xl uppercase mb-6">$4.99</p>
                    <ul className="space-y-3 mb-8 flex-1">
                      <li className="flex items-start gap-2.5 text-sm text-foreground/60">
                        <Check className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                        Unlimited resume analyses
                      </li>
                      <li className="flex items-start gap-2.5 text-sm text-foreground/60">
                        <Check className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                        Tailored cover letter generator
                      </li>
                      <li className="flex items-start gap-2.5 text-sm text-foreground/60">
                        <Check className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                        One-time payment, no subscription
                      </li>
                    </ul>
                    <Button asChild>
                      <Link href="/dashboard">Unlock Everything</Link>
                    </Button>
                  </div>
                </div>
              </Reveal>
            </div>
          </SectionFrame>

          {/* Quote band — tinted row, no number */}
          <SectionFrame className="bg-card">
            <Reveal className="max-w-3xl mx-auto px-6 py-24 md:py-32 relative">
              <Quote className="w-10 h-10 text-muted-foreground/40 mb-6" />
              <p className="font-display text-3xl md:text-4xl uppercase leading-tight mb-6">
                Six bullet points. Zero numbers. This reads like a to-do list, not a track record.
              </p>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Sample Verdict &middot; Tier C Resume
              </p>
            </Reveal>
          </SectionFrame>

          {/* 05 — FAQ */}
          <SectionFrame id="faq" number="05" eyebrow="Questions">
            <div className="max-w-2xl mx-auto px-6 py-24 md:py-32">
              <Reveal className="mb-12 text-center">
                <TwoToneTitle muted="Questions." bold="Answered." />
              </Reveal>
              <Reveal delay={100}>
                <Accordion type="single" collapsible>
                  {FAQS.map((f, i) => (
                    <AccordionItem key={i} value={`item-${i}`} className="border-border">
                      <AccordionTrigger className="font-medium text-left hover:no-underline hover:text-gold">
                        {f.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-foreground/60 leading-relaxed">
                        {f.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </Reveal>
            </div>
          </SectionFrame>

          {/* 06 — Bottom CTA */}
          <SectionFrame number="06" eyebrow="Your move">
            <div className="relative py-28 md:py-40 overflow-hidden">
              <div
                aria-hidden="true"
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(ellipse 55% 60% at 50% 100%, rgba(201,168,76,0.12) 0%, transparent 65%)',
                }}
              />
              <Reveal className="relative max-w-xl mx-auto px-6 text-center">
                <h2 className="font-display text-5xl md:text-7xl uppercase leading-[0.95] mb-5">
                  How bad is it,
                  <br />
                  <span className="text-gold">really?</span>
                </h2>
                <p className="text-foreground/60 mb-12">
                  You already know something&rsquo;s off. We&rsquo;ll just name it.
                </p>
                <Button asChild size="lg">
                  <Link href="/dashboard">
                    <Flame className="w-4 h-4" />
                    Get Roasted &mdash; Free
                  </Link>
                </Button>
              </Reveal>
            </div>
          </SectionFrame>
        </div>
      </main>

      <footer className="border-t border-border py-12">
        <div className="max-w-4xl mx-auto px-6 flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 mb-1">
            <Flame className="w-4 h-4 text-gold" />
            <span className="font-display text-lg uppercase tracking-wide leading-none pt-0.5">
              CandidAI
            </span>
          </div>
          <p className="text-center text-muted-foreground text-xs">
            &copy; {new Date().getFullYear()} CandidAI. Built for IT professionals who can handle
            the truth.
          </p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms of Service
            </Link>
            <Link href="/cookie-policy" className="hover:text-foreground transition-colors">
              Cookie Policy
            </Link>
            <Link href="/refund-policy" className="hover:text-foreground transition-colors">
              Refund Policy
            </Link>
            <Link href="/ai-disclaimer" className="hover:text-foreground transition-colors">
              AI Disclaimer
            </Link>
            <Link href="/upload-disclosure" className="hover:text-foreground transition-colors">
              Upload Disclosure
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
