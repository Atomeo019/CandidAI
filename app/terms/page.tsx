import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export const metadata = {
  title: 'Terms of Service — CandidAI',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <nav className="border-b border-slate-800">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-500" />
            <span className="text-lg font-bold gradient-text">CandidAI</span>
          </Link>
          <span className="text-slate-400 text-sm">Terms of Service</span>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-10">
        <div>
          <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
          <p className="text-slate-400 text-sm">Last updated: June 2025</p>
        </div>

        <Section title="Acceptance">
          <p>By using CandidAI you agree to these terms. If you do not agree, do not use the service. CandidAI is operated by Aravind Praveen. Contact: <a href="mailto:atomeo.019@gmail.com" className="text-purple-400 hover:underline">atomeo.019@gmail.com</a>.</p>
        </Section>

        <Section title="What CandidAI is">
          <p>CandidAI is an AI-powered resume analysis tool. It extracts text from your uploaded PDF, scores it against competitive tech hiring standards, and generates written feedback. It is an informational tool — not career advice, not a guarantee of employment outcomes.</p>
        </Section>

        <Section title="Your account">
          <ul className="list-disc list-inside space-y-2">
            <li>You must sign in with Google to access more than one free analysis.</li>
            <li>You are responsible for keeping your account secure.</li>
            <li>One account per person. Do not share accounts.</li>
          </ul>
        </Section>

        <Section title="Payments">
          <ul className="list-disc list-inside space-y-2">
            <li>The $4.99 purchase grants unlimited resume analyses and full cover letter generation. It is a one-time payment — no subscription, no auto-renewal.</li>
            <li>Payments are processed by Whop. We do not store your payment details.</li>
            <li>Due to the digital nature of the product, we do not offer refunds once access has been granted. If you experience a technical issue preventing you from accessing the product, contact us within 7 days.</li>
          </ul>
        </Section>

        <Section title="Acceptable use">
          <p>You agree not to:</p>
          <ul className="list-disc list-inside space-y-2">
            <li>Attempt to reverse-engineer, scrape, or extract our AI prompts or scoring logic.</li>
            <li>Use automated scripts to bulk-analyze resumes.</li>
            <li>Upload files that are not resumes or that contain malware.</li>
            <li>Circumvent usage limits by creating multiple accounts.</li>
          </ul>
        </Section>

        <Section title="Intellectual property">
          <p>The analysis and feedback generated for your resume belongs to you. CandidAI&apos;s software, prompts, scoring system, and UI are our intellectual property and may not be copied or reproduced.</p>
        </Section>

        <Section title="No warranty">
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl px-5 py-4">
            <p>CandidAI is provided &quot;as is&quot; without warranties of any kind. AI-generated feedback can be wrong. We do not guarantee that following our recommendations will result in interviews or job offers. Use the feedback as one input among many.</p>
          </div>
        </Section>

        <Section title="Limitation of liability">
          <p>To the maximum extent permitted by law, CandidAI and its operator are not liable for any indirect, incidental, or consequential damages arising from use of the service. Our total liability to you for any claim is limited to the amount you paid us in the 12 months preceding the claim.</p>
        </Section>

        <Section title="Termination">
          <p>We may suspend or terminate your account if you violate these terms. You may delete your account at any time by contacting us.</p>
        </Section>

        <Section title="Governing law">
          <p>These terms are governed by the laws of India. Disputes will be subject to the exclusive jurisdiction of courts in India.</p>
        </Section>
      </main>

      <footer className="border-t border-slate-800 mt-12 py-6">
        <div className="max-w-3xl mx-auto px-6 flex gap-6 text-sm text-slate-500">
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
