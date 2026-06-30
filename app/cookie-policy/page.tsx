import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export const metadata = {
  title: 'Cookie Policy — CandidAI',
};

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <nav className="border-b border-slate-800">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-500" />
            <span className="text-lg font-bold gradient-text">CandidAI</span>
          </Link>
          <span className="text-slate-400 text-sm">Cookie Policy</span>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-10">
        <div>
          <h1 className="text-3xl font-bold mb-2">Cookie Policy</h1>
          <p className="text-slate-400 text-sm">Last updated: June 2025</p>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl px-6 py-5">
          <p className="text-blue-300 font-semibold mb-1">The short version</p>
          <p className="text-slate-300 text-sm leading-relaxed">
            We use only essential cookies required to keep you signed in. We do not use advertising cookies, tracking pixels, or third-party analytics cookies.
          </p>
        </div>

        <Section title="What are cookies?">
          <p>Cookies are small text files stored in your browser. They allow websites to remember information about your visit — like whether you are logged in.</p>
        </Section>

        <Section title="Cookies we use">
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
        </Section>

        <Section title="Cookies we do NOT use">
          <ul className="list-disc list-inside space-y-2 text-slate-300">
            <li>Google Analytics or any other analytics platform</li>
            <li>Facebook Pixel, Meta, or any advertising network</li>
            <li>Hotjar, FullStory, or any session recording tool</li>
            <li>Any third-party tracking or retargeting cookies</li>
          </ul>
        </Section>

        <Section title="sessionStorage (not cookies)">
          <p>When you navigate from the results page to the cover letter page, we temporarily store your job description and analysis snippet in your browser&apos;s <code className="text-purple-300 bg-slate-800 px-1 rounded text-xs">sessionStorage</code>. This data lives only in your browser tab and is cleared as soon as it is read. It is never sent to our servers and disappears when you close the tab.</p>
        </Section>

        <Section title="Managing cookies">
          <p>You can block or delete cookies in your browser settings. Blocking essential cookies will break authentication — you will not be able to stay logged in. No other functionality is affected.</p>
          <p className="mt-2">Browser guides: <a href="https://support.google.com/chrome/answer/95647" className="text-purple-400 hover:underline" target="_blank" rel="noopener noreferrer">Chrome</a> · <a href="https://support.mozilla.org/en-US/kb/clear-cookies-and-site-data-firefox" className="text-purple-400 hover:underline" target="_blank" rel="noopener noreferrer">Firefox</a> · <a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471" className="text-purple-400 hover:underline" target="_blank" rel="noopener noreferrer">Safari</a></p>
        </Section>

        <Section title="Changes">
          <p>If we ever add new cookies we will update this page and the date above before they are set. Email <a href="mailto:atomeo.019@gmail.com" className="text-purple-400 hover:underline">atomeo.019@gmail.com</a> with any questions.</p>
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

function CookieRow({ name, type, purpose, duration }: {
  name: string; type: string; purpose: string; duration: string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
      <div className="flex items-center gap-3">
        <code className="text-purple-300 text-sm font-mono">{name}</code>
        <span className="text-xs bg-green-500/20 text-green-300 border border-green-500/30 px-2 py-0.5 rounded-full">{type}</span>
      </div>
      <p className="text-slate-300 text-sm">{purpose}</p>
      <p className="text-slate-500 text-xs">Duration: {duration}</p>
    </div>
  );
}
