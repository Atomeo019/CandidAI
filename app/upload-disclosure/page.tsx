import { Upload, Cpu, Trash2, Database, ShieldCheck } from 'lucide-react';
import { LegalShell, LegalCallout, legalLink } from '@/components/brand/LegalShell';

export const metadata = {
  title: 'Upload Disclosure — CandidAI',
};

export default function UploadDisclosurePage() {
  return (
    <LegalShell
      label="Upload Disclosure"
      title="What happens to your resume?"
      subtitle="Plain-English breakdown of what we do with your uploaded PDF"
    >
      <LegalCallout tone="confirm" title="The short version">
        <p>
          Your resume text is extracted, sent to an AI for analysis, and immediately discarded.
          It is <strong className="text-foreground">never written to a database</strong>, never stored in a file,
          and never logged. We store only the <strong className="text-foreground">scores and feedback</strong> — not your resume content.
        </p>
      </LegalCallout>

      <div className="space-y-4">
        <h2 className="font-display uppercase text-2xl tracking-tight">Step-by-step</h2>

        <Step icon={<Upload className="w-5 h-5 text-gold" />} number={1} title="You upload a PDF">
          Your browser sends the PDF file to our server over an encrypted HTTPS connection. The file is held in memory for the duration of the request only — it is never written to disk.
        </Step>

        <Step icon={<Cpu className="w-5 h-5 text-gold" />} number={2} title="We extract the text">
          We use a PDF parsing library to extract raw text from the file in memory. If the PDF is scanned (image-only), extraction may fail — we return an error rather than an empty analysis.
        </Step>

        <Step icon={<Cpu className="w-5 h-5 text-gold" />} number={3} title="We send the text to our AI">
          The extracted text is sent to Groq (our AI provider) for scoring. Groq processes it and returns a structured JSON response containing scores, tier, and feedback. We do not instruct Groq to retain your data; however, their own <a href="https://groq.com/privacy-policy/" className={legalLink} target="_blank" rel="noopener noreferrer">privacy policy</a> applies to this transfer.
        </Step>

        <Step icon={<Trash2 className="w-5 h-5 text-red-400" />} number={4} title="The text is discarded">
          Once the AI response is received, the resume text is gone. It is not saved anywhere. The request ends, the memory is freed, and the text no longer exists on our systems.
        </Step>

        <Step icon={<Database className="w-5 h-5 text-green-400" />} number={5} title="We store only the scores">
          If you are signed in, we save the analysis result to your account: scores, tier, feedback text, and detected role. <strong className="text-foreground">None of this includes your resume content</strong> — only the AI&apos;s output about it.
        </Step>
      </div>

      <div className="bg-card border border-border px-6 py-5 space-y-3">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-gold" />
          <h2 className="font-display uppercase text-xl tracking-tight">What this means for you</h2>
        </div>
        <ul className="list-disc list-inside space-y-2 text-foreground/70 text-sm">
          <li>You can upload your resume without fear of it being scraped, sold, or used to train AI models by us.</li>
          <li>We cannot produce your resume if asked — because we do not have it.</li>
          <li>Deleting your account removes your scores and feedback. There is no resume to delete because we never stored it.</li>
        </ul>
      </div>

      <p className="text-foreground/60 text-sm">
        Questions? Email <a href="mailto:atomeo.019@gmail.com" className={legalLink}>atomeo.019@gmail.com</a>.
      </p>
    </LegalShell>
  );
}

function Step({ icon, number, title, children }: {
  icon: React.ReactNode;
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 bg-card border border-border p-5">
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center">
        {icon}
      </div>
      <div className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Step {number}</p>
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-foreground/70 text-sm leading-relaxed">{children}</p>
      </div>
    </div>
  );
}
