import Link from 'next/link';
import { Sparkles, AlertTriangle } from 'lucide-react';

export const metadata = {
  title: 'AI Disclaimer — CandidAI',
};

export default function AIDisclaimerPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <nav className="border-b border-slate-800">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-500" />
            <span className="text-lg font-bold gradient-text">CandidAI</span>
          </Link>
          <span className="text-slate-400 text-sm">AI Disclaimer</span>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-10">
        <div>
          <h1 className="text-3xl font-bold mb-2">AI Disclaimer</h1>
          <p className="text-slate-400 text-sm">Last updated: June 2025</p>
        </div>

        <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl px-6 py-5 flex gap-4">
          <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-orange-300 font-semibold mb-1">AI-generated content — use your judgment</p>
            <p className="text-slate-300 text-sm leading-relaxed">
              CandidAI uses a large language model (LLM) to analyze resumes and generate feedback. AI can be wrong. It can hallucinate, misread context, and apply standards inconsistently. Treat every piece of feedback as a starting point — not a verdict.
            </p>
          </div>
        </div>

        <Section title="How the AI works">
          <p>CandidAI uses Groq&apos;s inference API running Meta&apos;s <code className="text-purple-300 bg-slate-800 px-1 rounded text-xs">llama-3.3-70b-versatile</code> model. Your resume text and a structured prompt are sent to the model, which returns scores, tier classification, and written feedback. The model has been trained on a large corpus of text data with a knowledge cutoff date — it does not have real-time knowledge of job markets, specific company hiring practices, or current industry standards.</p>
        </Section>

        <Section title="What the AI can and cannot do">
          <div className="grid grid-cols-1 gap-3 mt-1">
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
              <p className="text-green-300 font-semibold text-sm mb-2">It can reasonably assess:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-300 text-sm">
                <li>Whether your resume follows common structural conventions</li>
                <li>Whether your bullet points contain metrics and specific outcomes</li>
                <li>Whether your skills section aligns with the role you describe</li>
                <li>General ATS keyword density and formatting signals</li>
              </ul>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <p className="text-red-300 font-semibold text-sm mb-2">It cannot reliably assess:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-300 text-sm">
                <li>Whether a specific company will hire you</li>
                <li>Current real-time hiring market conditions</li>
                <li>Whether your specific experience meets a specific team&apos;s bar</li>
                <li>Non-English resumes (accuracy degrades significantly)</li>
                <li>Highly specialized or niche roles with limited training data</li>
              </ul>
            </div>
          </div>
        </Section>

        <Section title="Known limitations">
          <ul className="list-disc list-inside space-y-2 text-slate-300">
            <li><strong className="text-white">Scores are relative, not absolute.</strong> A score of 78/100 does not mean you will get interviews at 78% of companies you apply to. Scores are calibrated against common patterns in our prompt — not against any real hiring database.</li>
            <li><strong className="text-white">Cover letters may contain inaccuracies.</strong> The model generates cover letters based on the text in your resume and the job description you provide. It may occasionally infer details that are not explicitly stated. Always review before sending.</li>
            <li><strong className="text-white">The model can hallucinate.</strong> Large language models sometimes produce confident-sounding but incorrect statements. If a piece of feedback seems wrong, it may be.</li>
            <li><strong className="text-white">PDF parsing is imperfect.</strong> Complex layouts, multi-column formats, graphics, or embedded fonts may cause text extraction errors that affect the quality of analysis.</li>
          </ul>
        </Section>

        <Section title="This is not professional career advice">
          <p>CandidAI is an automated tool, not a career coach, recruiter, or HR professional. The feedback it generates does not constitute professional career advice. We strongly recommend using CandidAI&apos;s output alongside human feedback from mentors, recruiters, or career services.</p>
        </Section>

        <Section title="No guarantee of outcome">
          <p>Using CandidAI does not guarantee job interviews, offers, or any specific hiring outcome. Resume quality is one factor among many in hiring decisions. CandidAI makes no representations about the effectiveness of its feedback in improving hiring outcomes.</p>
        </Section>

        <Section title="Questions">
          <p>Email <a href="mailto:atomeo.019@gmail.com" className="text-purple-400 hover:underline">atomeo.019@gmail.com</a> with any concerns about AI-generated content.</p>
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
