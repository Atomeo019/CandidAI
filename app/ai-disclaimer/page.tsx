import { AlertTriangle } from 'lucide-react';
import { LegalShell, LegalSection, LegalCallout, legalLink, legalCode } from '@/components/brand/LegalShell';
import { GROQ_TEXT_MODEL } from '@/lib/constants';

export const metadata = {
  title: 'AI Disclaimer — CandidAI',
};

export default function AIDisclaimerPage() {
  return (
    <LegalShell label="AI Disclaimer" title="AI Disclaimer" subtitle="Last updated: June 2025">
      <div className="border border-gold/30 bg-gold/5 px-6 py-5 flex gap-4">
        <AlertTriangle className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.15em] text-gold font-medium mb-2">
            AI-generated content — use your judgment
          </p>
          <p className="text-foreground/70 text-sm leading-relaxed">
            CandidAI uses a large language model (LLM) to analyze resumes and generate feedback. AI can be wrong. It can hallucinate, misread context, and apply standards inconsistently. Treat every piece of feedback as a starting point — not a verdict.
          </p>
        </div>
      </div>

      <LegalSection title="How the AI works">
        <p>CandidAI uses Groq&apos;s inference API, currently running the <code className={legalCode}>{GROQ_TEXT_MODEL}</code> model, with automatic fallback to smaller models if it is unavailable. Your resume text and a structured prompt are sent to the model, which returns scores, tier classification, and written feedback. The model has been trained on a large corpus of text data with a knowledge cutoff date — it does not have real-time knowledge of job markets, specific company hiring practices, or current industry standards.</p>
      </LegalSection>

      <LegalSection title="What the AI can and cannot do">
        <div className="grid grid-cols-1 gap-3 mt-1">
          <LegalCallout tone="confirm" title="It can reasonably assess:">
            <ul className="list-disc list-inside space-y-1">
              <li>Whether your resume follows common structural conventions</li>
              <li>Whether your bullet points contain metrics and specific outcomes</li>
              <li>Whether your skills section aligns with the role you describe</li>
              <li>General ATS keyword density and formatting signals</li>
            </ul>
          </LegalCallout>
          <LegalCallout tone="danger" title="It cannot reliably assess:">
            <ul className="list-disc list-inside space-y-1">
              <li>Whether a specific company will hire you</li>
              <li>Current real-time hiring market conditions</li>
              <li>Whether your specific experience meets a specific team&apos;s bar</li>
              <li>Non-English resumes (accuracy degrades significantly)</li>
              <li>Highly specialized or niche roles with limited training data</li>
            </ul>
          </LegalCallout>
        </div>
      </LegalSection>

      <LegalSection title="Known limitations">
        <ul className="list-disc list-inside space-y-2">
          <li><strong className="text-foreground">Scores are relative, not absolute.</strong> A score of 78/100 does not mean you will get interviews at 78% of companies you apply to. Scores are calibrated against common patterns in our prompt — not against any real hiring database.</li>
          <li><strong className="text-foreground">Cover letters may contain inaccuracies.</strong> The model generates cover letters based on the text in your resume and the job description you provide. It may occasionally infer details that are not explicitly stated. Always review before sending.</li>
          <li><strong className="text-foreground">The model can hallucinate.</strong> Large language models sometimes produce confident-sounding but incorrect statements. If a piece of feedback seems wrong, it may be.</li>
          <li><strong className="text-foreground">PDF parsing is imperfect.</strong> Complex layouts, multi-column formats, graphics, or embedded fonts may cause text extraction errors that affect the quality of analysis.</li>
        </ul>
      </LegalSection>

      <LegalSection title="This is not professional career advice">
        <p>CandidAI is an automated tool, not a career coach, recruiter, or HR professional. The feedback it generates does not constitute professional career advice. We strongly recommend using CandidAI&apos;s output alongside human feedback from mentors, recruiters, or career services.</p>
      </LegalSection>

      <LegalSection title="No guarantee of outcome">
        <p>Using CandidAI does not guarantee job interviews, offers, or any specific hiring outcome. Resume quality is one factor among many in hiring decisions. CandidAI makes no representations about the effectiveness of its feedback in improving hiring outcomes.</p>
      </LegalSection>

      <LegalSection title="Questions">
        <p>Email <a href="mailto:atomeo.019@gmail.com" className={legalLink}>atomeo.019@gmail.com</a> with any concerns about AI-generated content.</p>
      </LegalSection>
    </LegalShell>
  );
}
