import { LegalShell, LegalSection, LegalCallout, legalLink, legalCode } from '@/components/brand/LegalShell';

export const metadata = {
  title: 'Refund Policy — CandidAI',
};

export default function RefundPolicyPage() {
  return (
    <LegalShell label="Refund Policy" title="Refund Policy" subtitle="Last updated: June 2025">
      <LegalCallout tone="gold" title="The short version">
        <p>We offer a 7-day refund window if the product did not work for you. Once you have used the product (run a paid analysis or generated a cover letter), we do not issue refunds — the service has been delivered.</p>
      </LegalCallout>

      <LegalSection title="What you purchased">
        <p>The $4.99 one-time payment unlocks unlimited resume analyses and full cover letter generation on your account. This is a digital product — access is granted immediately upon payment confirmation.</p>
      </LegalSection>

      <LegalSection title="When we issue refunds">
        <p>You are eligible for a full refund if <strong className="text-foreground">all</strong> of the following are true:</p>
        <ul className="list-disc list-inside space-y-2 mt-2">
          <li>You contact us within <strong className="text-foreground">7 days</strong> of your purchase.</li>
          <li>You have not run a paid resume analysis or generated a cover letter after purchasing.</li>
          <li>You can describe a specific technical issue that prevented you from using the product.</li>
        </ul>
      </LegalSection>

      <LegalSection title="When we do not issue refunds">
        <ul className="list-disc list-inside space-y-2">
          <li>You changed your mind after access was granted.</li>
          <li>You have already used the paid features (analysis or cover letter).</li>
          <li>You purchased more than 7 days ago.</li>
          <li>The AI feedback did not meet your expectations — AI output is inherently variable and we do not guarantee specific results.</li>
        </ul>
      </LegalSection>

      <LegalSection title="How to request a refund">
        <p>Email <a href="mailto:atomeo.019@gmail.com" className={legalLink}>atomeo.019@gmail.com</a> with:</p>
        <ul className="list-disc list-inside space-y-2 mt-2">
          <li>Subject line: <code className={legalCode}>Refund Request — CandidAI</code></li>
          <li>The email address on your CandidAI account.</li>
          <li>A brief description of the issue.</li>
        </ul>
        <p className="mt-3">We will respond within <strong className="text-foreground">3 business days</strong>. If approved, refunds are processed through Whop and typically appear within 5&ndash;10 business days depending on your bank.</p>
      </LegalSection>

      <LegalSection title="Disputes">
        <p>If you feel a refund was wrongly denied, you may file a dispute through Whop or your payment provider. We will cooperate fully with any legitimate dispute process.</p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>Questions? Email <a href="mailto:atomeo.019@gmail.com" className={legalLink}>atomeo.019@gmail.com</a>.</p>
      </LegalSection>
    </LegalShell>
  );
}
