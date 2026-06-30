import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export const metadata = {
  title: 'Refund Policy — CandidAI',
};

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <nav className="border-b border-slate-800">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-500" />
            <span className="text-lg font-bold gradient-text">CandidAI</span>
          </Link>
          <span className="text-slate-400 text-sm">Refund Policy</span>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-10">
        <div>
          <h1 className="text-3xl font-bold mb-2">Refund Policy</h1>
          <p className="text-slate-400 text-sm">Last updated: June 2025</p>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl px-6 py-5">
          <p className="text-amber-300 font-semibold mb-1">The short version</p>
          <p className="text-slate-300 text-sm leading-relaxed">
            We offer a 7-day refund window if the product did not work for you. Once you have used the product (run a paid analysis or generated a cover letter), we do not issue refunds — the service has been delivered.
          </p>
        </div>

        <Section title="What you purchased">
          <p>The $4.99 one-time payment unlocks unlimited resume analyses and full cover letter generation on your account. This is a digital product — access is granted immediately upon payment confirmation.</p>
        </Section>

        <Section title="When we issue refunds">
          <p>You are eligible for a full refund if <strong className="text-white">all</strong> of the following are true:</p>
          <ul className="list-disc list-inside space-y-2 text-slate-300 mt-2">
            <li>You contact us within <strong className="text-white">7 days</strong> of your purchase.</li>
            <li>You have not run a paid resume analysis or generated a cover letter after purchasing.</li>
            <li>You can describe a specific technical issue that prevented you from using the product.</li>
          </ul>
        </Section>

        <Section title="When we do not issue refunds">
          <ul className="list-disc list-inside space-y-2 text-slate-300">
            <li>You changed your mind after access was granted.</li>
            <li>You have already used the paid features (analysis or cover letter).</li>
            <li>You purchased more than 7 days ago.</li>
            <li>The AI feedback did not meet your expectations — AI output is inherently variable and we do not guarantee specific results.</li>
          </ul>
        </Section>

        <Section title="How to request a refund">
          <p>Email <a href="mailto:atomeo.019@gmail.com" className="text-purple-400 hover:underline">atomeo.019@gmail.com</a> with:</p>
          <ul className="list-disc list-inside space-y-2 text-slate-300 mt-2">
            <li>Subject line: <code className="text-purple-300 bg-slate-800 px-1 rounded text-xs">Refund Request — CandidAI</code></li>
            <li>The email address on your CandidAI account.</li>
            <li>A brief description of the issue.</li>
          </ul>
          <p className="mt-3">We will respond within <strong className="text-white">3 business days</strong>. If approved, refunds are processed through Whop and typically appear within 5–10 business days depending on your bank.</p>
        </Section>

        <Section title="Disputes">
          <p>If you feel a refund was wrongly denied, you may file a dispute through Whop or your payment provider. We will cooperate fully with any legitimate dispute process.</p>
        </Section>

        <Section title="Contact">
          <p>Questions? Email <a href="mailto:atomeo.019@gmail.com" className="text-purple-400 hover:underline">atomeo.019@gmail.com</a>.</p>
        </Section>
      </main>

      <footer className="border-t border-slate-800 mt-12 py-6">
        <div className="max-w-3xl mx-auto px-6 flex flex-wrap gap-6 text-sm text-slate-500">
          <Link href="/privacy" className="hover:text-slate-300 transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-slate-300 transition-colors">Terms</Link>
          <Link href="/cookie-policy" className="hover:text-slate-300 transition-colors">Cookies</Link>
          <Link href="/refund-policy" className="hover:text-slate-300 transition-colors">Refunds</Link>
          <Link href="/ai-disclaimer" className="hover:text-slate-300 transition-colors">AI Disclaimer</Link>
          <Link href="/upload-disclosure" className="hover:text-slate-300 transition-colors">Upload Disclosure</Link>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <div className="text-slate-300 leading-relaxed text-sm space-y-2">{children}</div>
    </section>
  );
}
