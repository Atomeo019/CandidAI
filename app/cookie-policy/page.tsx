import { LegalShell, LegalSection, LegalCallout, legalLink, legalCode } from '@/components/brand/LegalShell';

export const metadata = {
  title: 'Cookie Policy — CandidAI',
};

export default function CookiePolicyPage() {
  return (
    <LegalShell label="Cookie Policy" title="Cookie Policy" subtitle="Last updated: June 2025">
      <LegalCallout tone="gold" title="The short version">
        <p>We use only essential cookies required to keep you signed in. We do not use advertising cookies, tracking pixels, or third-party analytics cookies.</p>
      </LegalCallout>

      <LegalSection title="What are cookies?">
        <p>Cookies are small text files stored in your browser. They allow websites to remember information about your visit — like whether you are logged in.</p>
      </LegalSection>

      <LegalSection title="Cookies we use">
        <div className="space-y-4">
          <CookieRow
            name="__session (Clerk)"
            type="Essential"
            purpose="Keeps you authenticated. Set by Clerk, our authentication provider. Without this cookie you would be logged out on every page load."
            duration="Session / up to 7 days"
          />
          <CookieRow
            name="__clerk_db_jwt"
            type="Essential"
            purpose="A short-lived JWT used by Clerk to verify your session with our server."
            duration="Session"
          />
        </div>
      </LegalSection>

      <LegalSection title="Cookies we do NOT use">
        <ul className="list-disc list-inside space-y-2">
          <li>Google Analytics or any other analytics platform</li>
          <li>Facebook Pixel, Meta, or any advertising network</li>
          <li>Hotjar, FullStory, or any session recording tool</li>
          <li>Any third-party tracking or retargeting cookies</li>
        </ul>
      </LegalSection>

      <LegalSection title="sessionStorage (not cookies)">
        <p>When you navigate from the results page to the cover letter page, we temporarily store your job description and analysis snippet in your browser&apos;s <code className={legalCode}>sessionStorage</code>. This data lives only in your browser tab and is cleared as soon as it is read. It is never sent to our servers and disappears when you close the tab.</p>
      </LegalSection>

      <LegalSection title="Managing cookies">
        <p>You can block or delete cookies in your browser settings. Blocking essential cookies will break authentication — you will not be able to stay logged in. No other functionality is affected.</p>
        <p className="mt-2">Browser guides: <a href="https://support.google.com/chrome/answer/95647" className={legalLink} target="_blank" rel="noopener noreferrer">Chrome</a> &middot; <a href="https://support.mozilla.org/en-US/kb/clear-cookies-and-site-data-firefox" className={legalLink} target="_blank" rel="noopener noreferrer">Firefox</a> &middot; <a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471" className={legalLink} target="_blank" rel="noopener noreferrer">Safari</a></p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>If we ever add new cookies we will update this page and the date above before they are set. Email <a href="mailto:atomeo.019@gmail.com" className={legalLink}>atomeo.019@gmail.com</a> with any questions.</p>
      </LegalSection>
    </LegalShell>
  );
}

function CookieRow({ name, type, purpose, duration }: {
  name: string; type: string; purpose: string; duration: string;
}) {
  return (
    <div className="bg-card border border-border p-5 space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <code className="font-mono text-sm text-gold">{name}</code>
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] border border-green-500/30 bg-green-500/10 text-green-400 px-2 py-0.5">
          {type}
        </span>
      </div>
      <p className="text-foreground/70 text-sm leading-relaxed">{purpose}</p>
      <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Duration: {duration}</p>
    </div>
  );
}
