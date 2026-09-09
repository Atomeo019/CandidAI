import { LegalShell, LegalSection, LegalCallout, legalLink } from '@/components/brand/LegalShell';

export const metadata = {
  title: 'Terms of Service — CandidAI',
};

export default function TermsPage() {
  return (
    <LegalShell label="Terms of Service" title="Terms of Service" subtitle="Last updated: June 2025">
      <LegalSection title="Acceptance">
        <p>By using CandidAI you agree to these terms. If you do not agree, do not use the service. CandidAI is operated by Aravind Praveen. Contact: <a href="mailto:atomeo.019@gmail.com" className={legalLink}>atomeo.019@gmail.com</a>.</p>
      </LegalSection>

      <LegalSection title="What CandidAI is">
        <p>CandidAI is an AI-powered resume analysis tool. It extracts text from your uploaded PDF, scores it against competitive tech hiring standards, and generates written feedback. It is an informational tool — not career advice, not a guarantee of employment outcomes.</p>
      </LegalSection>

      <LegalSection title="Your account">
        <ul className="list-disc list-inside space-y-2">
          <li>You must be signed in to run any analysis. New accounts get three free analyses.</li>
          <li>You are responsible for keeping your account secure.</li>
          <li>One account per person. Do not share accounts.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Payments">
        <ul className="list-disc list-inside space-y-2">
          <li>The $4.99 purchase grants unlimited resume analyses and full cover letter generation. It is a one-time payment — no subscription, no auto-renewal.</li>
          <li>Payments are processed by Whop. We do not store your payment details.</li>
          <li>Due to the digital nature of the product, we do not offer refunds once access has been granted. If you experience a technical issue preventing you from accessing the product, contact us within 7 days.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc list-inside space-y-2">
          <li>Attempt to reverse-engineer, scrape, or extract our AI prompts or scoring logic.</li>
          <li>Use automated scripts to bulk-analyze resumes.</li>
          <li>Upload files that are not resumes or that contain malware.</li>
          <li>Circumvent usage limits by creating multiple accounts.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Intellectual property">
        <p>The analysis and feedback generated for your resume belongs to you. CandidAI&apos;s software, prompts, scoring system, and UI are our intellectual property and may not be copied or reproduced.</p>
      </LegalSection>

      <LegalSection title="No warranty">
        <LegalCallout tone="gold">
          <p>CandidAI is provided &quot;as is&quot; without warranties of any kind. AI-generated feedback can be wrong. We do not guarantee that following our recommendations will result in interviews or job offers. Use the feedback as one input among many.</p>
        </LegalCallout>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <p>To the maximum extent permitted by law, CandidAI and its operator are not liable for any indirect, incidental, or consequential damages arising from use of the service. Our total liability to you for any claim is limited to the amount you paid us in the 12 months preceding the claim.</p>
      </LegalSection>

      <LegalSection title="Termination">
        <p>We may suspend or terminate your account if you violate these terms. You may delete your account at any time by contacting us.</p>
      </LegalSection>

      <LegalSection title="Governing law">
        <p>These terms are governed by the laws of India. Disputes will be subject to the exclusive jurisdiction of courts in India.</p>
      </LegalSection>
    </LegalShell>
  );
}
