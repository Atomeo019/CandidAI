import Link from 'next/link';
import { ArrowRight, Sparkles, Flame, Trophy, Share2 } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <nav className="border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-7 h-7 text-purple-500" />
              <span className="text-xl font-bold gradient-text">ResumeRoast</span>
            </div>
            <Link
              href="/dashboard"
              className="px-4 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors"
            >
              Roast Mine
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* ── Hero ── */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-slate-950 to-slate-950" />
          <div className="absolute inset-0">
            <div className="absolute top-20 left-20 w-72 h-72 bg-purple-600/10 rounded-full blur-3xl" />
            <div className="absolute bottom-20 right-20 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
          </div>

          <div className="relative max-w-7xl mx-auto px-6 pt-32 pb-24">
            <div className="max-w-4xl mx-auto text-center">

              {/* Pill */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/30 mb-8">
                <Flame className="w-4 h-4 text-orange-400" />
                <span className="text-sm text-orange-300 font-semibold">Free Brutal Roast for IT Professionals</span>
              </div>

              {/* Headline */}
              <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight tracking-tight">
                Your Resume Has a Tier.{' '}
                <span className="gradient-text">Find Out If It&apos;s S or F.</span>
              </h1>

              {/* Sub */}
              <p className="text-lg md:text-xl text-slate-400 mb-4 leading-relaxed max-w-2xl mx-auto">
                Drop your resume. Get a tier from <span className="text-yellow-400 font-bold">S</span> (elite) to <span className="text-red-400 font-bold">F</span> (rebuild from scratch), a brutal AI roast that names exactly what&apos;s wrong, and a shareable card for the internet to judge.
              </p>
              <p className="text-sm text-slate-500 mb-10">
                60% savage wit &nbsp;·&nbsp; 40% cold truth &nbsp;·&nbsp; 0% sugarcoating
              </p>

              {/* CTA */}
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-3 px-10 py-4 rounded-xl gradient-purple text-white font-bold text-lg hover:opacity-90 transition-opacity shadow-xl shadow-purple-500/30"
              >
                <Flame className="w-5 h-5" />
                Roast My Resume — Free
                <ArrowRight className="w-5 h-5" />
              </Link>

              <p className="text-xs text-slate-600 mt-5">
                No signup required &nbsp;·&nbsp; Results in under 10 seconds &nbsp;·&nbsp; IT industry only (for now)
              </p>
            </div>
          </div>
        </section>

        {/* ── Tier preview strip ── */}
        <section className="py-8 border-y border-slate-800 overflow-hidden">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center justify-center gap-3 md:gap-6 flex-wrap">
              {(['S','A','B','C','D','F'] as const).map((t) => {
                const colors: Record<string, string> = {
                  S: 'bg-yellow-400 text-yellow-900',
                  A: 'bg-green-400 text-green-900',
                  B: 'bg-blue-400 text-blue-900',
                  C: 'bg-orange-400 text-orange-900',
                  D: 'bg-red-500 text-red-950',
                  F: 'bg-slate-600 text-slate-100',
                };
                const labels: Record<string, string> = {
                  S: 'Exceptional',
                  A: 'Strong',
                  B: 'Solid',
                  C: 'Needs Work',
                  D: 'Struggling',
                  F: 'Start Over',
                };
                return (
                  <div key={t} className="flex flex-col items-center gap-1">
                    <div className={`w-12 h-12 md:w-16 md:h-16 rounded-xl flex items-center justify-center font-black text-2xl md:text-3xl ${colors[t]}`}>
                      {t}
                    </div>
                    <span className="text-xs text-slate-500">{labels[t]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="py-24 border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid md:grid-cols-3 gap-12">

              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 mb-6">
                  <Trophy className="w-8 h-8 text-yellow-400" />
                </div>
                <h3 className="text-xl font-bold mb-3">Tier S to F</h3>
                <p className="text-slate-400 leading-relaxed">
                  You&apos;re graded like a game. S is elite. F means rebuild. Most resumes land at C and pretend they&apos;re A. Ours doesn&apos;t lie.
                </p>
              </div>

              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 mb-6">
                  <Flame className="w-8 h-8 text-orange-400" />
                </div>
                <h3 className="text-xl font-bold mb-3">The Roast</h3>
                <p className="text-slate-400 leading-relaxed">
                  Our AI channels your harshest senior interviewer. It reads your actual resume — then calls out the specific line that&apos;s killing your chances.
                </p>
              </div>

              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 mb-6">
                  <Share2 className="w-8 h-8 text-purple-400" />
                </div>
                <h3 className="text-xl font-bold mb-3">Share the Burn</h3>
                <p className="text-slate-400 leading-relaxed">
                  Get a vertical share card built for Reels. Post your tier. Let the internet weigh in on your career decisions. Roast a colleague.
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* ── Bottom CTA ── */}
        <section className="py-24">
          <div className="max-w-2xl mx-auto px-6 text-center">
            <h2 className="text-4xl md:text-5xl font-black mb-4">
              How bad is it <span className="gradient-text">really?</span>
            </h2>
            <p className="text-slate-400 mb-10">
              You already know something&apos;s off. We&apos;ll just name it.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-3 px-10 py-4 rounded-xl gradient-purple text-white font-bold text-lg hover:opacity-90 transition-opacity shadow-xl shadow-purple-500/30"
            >
              <Flame className="w-5 h-5" />
              Get Roasted — Free
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 py-8">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-slate-500 text-sm">
            &copy; {new Date().getFullYear()} ResumeRoast. Built for IT professionals who can handle the truth.
          </p>
        </div>
      </footer>
    </div>
  );
}
