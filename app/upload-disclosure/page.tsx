import Link from 'next/link';
import { Sparkles, Upload, Cpu, Trash2, Database, ShieldCheck } from 'lucide-react';

export const metadata = {
  title: 'Upload Disclosure — CandidAI',
};

export default function UploadDisclosurePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <nav className="border-b border-slate-800">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-500" />
            <span className="text-lg font-bold gradient-text">CandidAI</span>
          </Link>
          <span className="text-slate-400 text-sm">Upload Disclosure</span>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-10">
        <div>
          <h1 className="text-3xl font-bold mb-2">What happens to your resume?</h1>
          <p className="text-slate-400 text-sm">Plain-English breakdown of exactly what we do with your uploaded PDF.</p>
        </div>

        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl px-6 py-5">
          <p className="text-green-300 font-semibold text-lg mb-1">The short version</p>
          <p className="text-slate-300 text-sm leading-relaxed">
            Your resume text is extracted, sent to an AI for analysis, and immediately discarded.
            It is <strong className="text-white">never written to a database</strong>, never stored in a file,
            and never logged. We store only the <strong className="text-white">scores and feedback</strong> — not your resume content.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Step-by-step</h2>

          <Step icon={<Upload className="w-5 h-5 text-purple-400" />} number={1} title="You upload a PDF">
            Your browser sends the PDF file to our server over an encrypted HTTPS connection. The file is held in memory for the duration of the request only — it is never written to disk.
          </Step>

          <Step icon={<Cpu className="w-5 h-5 text-blue-400" />} number={2} title="We extract the text">
            We use a PDF parsing library to extract raw text from the file in memory. If the PDF is scanned (image-only), extraction may fail — we return an error rather than an empty analysis.
          </Step>

          <Step icon={<Cpu className="w-5 h-5 text-yellow-400" />} number={3} title="We send the text to our AI">
            The extracted text is sent to Groq (our AI provider) for scoring. Groq processes it and returns a structured JSON response containing scores, tier, and feedback. We do not instruct Groq to retain your data; however, their own <a href="https://groq.com/privacy-policy/" className="text-purple-400 hover:underline" target="_blank" rel="noopener noreferrer">privacy policy</a> applies to this transfer.
          </Step>

          <Step icon={<Trash2 className="w-5 h-5 text-red-400" />} number={4} title="The text is discarded">
            Once the AI response is received, the resume text is gone. It is not saved anywhere. The request ends, the memory is freed, and the text no longer exists on our systems.
          </Step>

          <Step icon={<Database className="w-5 h-5 text-green-400" />} number={5} title="We store only the scores">
            If you are signed in, we save the analysis result to your account: scores, tier, feedback text, and detected role. <strong className="text-white">None of this includes your resume content</strong> — only the AI&apos;s output about it.
          </Step>
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-2xl px-6 py-5 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold">What this means for you</h2>
          </div>
          <ul className="list-disc list-inside space-y-2 text-slate-300 text-sm">
            <li>You can upload your resume without fear of it being scraped, sold, or used to train AI models by us.</li>
            <li>We cannot produce your resume if asked — because we do not have it.</li>
            <li>Deleting your account removes your scores and feedback. There is no resume to delete because we never stored it.</li>
          </ul>
        </div>

        <p className="text-slate-400 text-sm">
          Questions? Email <a href="mailto:atomeo.019@gmail.com" className="text-purple-400 hover:underline">atomeo.019@gmail.com</a>.
        </p>
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

function Step({ icon, number, title, children }: {
  icon: React.ReactNode;
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
        {icon}
      </div>
      <div className="space-y-1">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">Step {number}</p>
        <p className="font-semibold text-white">{title}</p>
        <p className="text-slate-300 text-sm leading-relaxed">{children}</p>
      </div>
    </div>
  );
}
