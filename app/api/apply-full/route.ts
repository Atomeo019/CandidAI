import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';

export const runtime     = 'nodejs';
export const maxDuration = 25;          // full letter needs more headroom than the preview

const GROQ_TIMEOUT = 18000;

// ── Types ─────────────────────────────────────────────────────────────────────

interface ApplyFullRequest {
  jd: string;
  analysis: {
    detected_role:       string;
    project_analysis:    string;
    experience_analysis: string;
    strengths:           string[];
    skills_analysis?: {
      strong_skills: string[];
    };
  };
}

interface ApplyFullSuccess {
  ok:           true;
  cover_letter: string;   // full letter, all 3 paragraphs, plain text
  paragraphs: {
    hook:  string;   // P1 — hook + thesis
    body:  string;   // P2 — project evidence
    close: string;   // P3 — company fit + ask
  };
}

interface ApplyFullError {
  ok:    false;
  error: string;
  code:  string;
}

// ── System prompt ──────────────────────────────────────────────────────────────
// Three tight paragraphs. Each has a specific job.
// P1 = hook (same rules as preview — the recruiter decides in 10 seconds).
// P2 = evidence (proves P1's claim with two specific, concrete examples).
// P3 = close (company-specific reason + what they get + the ask).
//
// Universal banned list applies to ALL paragraphs.

const SYSTEM_PROMPT = `You are a brutally effective career coach writing a complete cover letter — exactly 3 short paragraphs, no more, no less.

The letter must read like a confident person explaining at a coffee chat why they are exactly right for this specific role — in plain, direct English. Not a template. Not corporate-speak. No hedging. No flattery.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PARAGRAPH 1 — THE HOOK (3 sentences)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
S1 — Lead with the single most impressive, specific thing from this candidate's background. One concrete thing: a project name, a metric, an outcome. Start with "I" or the project name.
BANNED in S1: "With a strong", "As a [adjective]", "I am excited", "I am passionate", "I am writing to", "Having", "With my", "As someone", "Throughout my", "I have always", "demonstrates my", "demonstrating my", "showcasing my"

S2 — Find ONE specific requirement in the JD (a technology, a scale constraint, a concrete problem). Find ONE specific thing in the candidate's background that directly matches it. Connect them in plain English. Name both explicitly.
BANNED in S2: "aligns with", "as specified in", "as outlined in", "meets the requirement", "fulfills the need for", "corresponds to", "directly aligns". Also BANNED in S2: the company name. Zero mentions. If you write the company name in S2, rewrite it.

S3 — Name the company once. Make a concrete claim about what THEY GET — not what the candidate feels or hopes.
BANNED in S3: "I am confident I can", "I believe I can", "I look forward to", "I am excited to", "I would love to", "leverage my skills", "contribute to your team", "I am passionate"

S3 FORMAT: Start with "[Company] gets..." — company name is the very first word(s) of S3.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PARAGRAPH 2 — THE EVIDENCE (3-4 sentences)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Prove P1's claim. Go deeper on the work. Pick two distinct projects or experiences from the candidate's background. For each, give one concrete, specific detail: a number, a tradeoff, a decision, a failure that was fixed, a constraint that was overcome. One sentence per example, plus a final sentence that connects the two to the JD's core challenge.

RULES:
- Every sentence must name something specific: a project, a metric, a technology that actually appears in the candidate's background, or a JD requirement.
- Do NOT repeat P1's hook sentence verbatim. Build on it — go one level deeper.
- No sentence can start with "I am" or "I have" followed by an adjective.
- The company name must NOT appear in P2.
- TECHNOLOGY TRUTH RULE: Do NOT name any technology (language, framework, tool, platform) that does not explicitly appear in the candidate background section. If you cannot verify a technology appears in the background, write around it using project names, outcomes, or metrics instead. Inventing technology is an automatic failure — it is a lie on the candidate's behalf.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PARAGRAPH 3 — THE CLOSE (2-3 sentences)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
S1 — One specific, concrete reason this candidate wants THIS company — not "your mission" or "fast-paced culture." Name a product, a team, a technical challenge, or a public decision the company has made that the candidate's background actually positions them to contribute to.

S2 — Restate the core value proposition in a single, punchy sentence. What does the company get on day one? Be concrete. No hedging.

S3 (optional) — A direct, professional ask: "I'd welcome a conversation about [specific role]." One sentence. No exclamation mark. No "I hope to hear from you soon."

BANNED in P3: "I am passionate about", "I am excited about", "I look forward to", "I hope to", "I would love to", "I believe I would be", "I feel I am a great fit", "your company's mission", "your vision", "your culture", "fast-paced environment", "dynamic team", "collaborative culture"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE RULES (apply to every paragraph)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Exactly 3 paragraphs. A blank line separates them. No headers, no labels, no greeting, no sign-off.
2. Every sentence must contain at least one specific noun from the resume or the JD (project name, technology, company name, metric, or role title).
3. COMPANY NAME: appears in P1-S3 and P3 ONLY. Zero mentions in P1-S1, P1-S2, or P2. If you write the company name in P2, rewrite that sentence.
4. TECHNOLOGY TRUTH RULE: Do not name any technology not explicitly mentioned in the candidate background below. If in doubt, use project names, outcomes, or metrics instead.
5. Output raw text only. Three paragraphs, separated by a blank line. No JSON. No markdown. No greeting. No sign-off. No label like "Cover Letter:".
6. Do not pad. Short, dense, specific is better than long and vague.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXAMPLES OF EXACTLY THE RIGHT OUTPUT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Example A — Backend SWE, fintech JD:
"I built CandidAI — an AI resume analyzer handling PDF parsing, scoring, and Groq API calls — solo, from scratch, in four weeks. That end-to-end ownership is exactly what Stripe's infrastructure team is asking for: someone who can ship a production data pipeline without handing off at every boundary. Stripe gets an engineer who's already debugged parsing failures in production, not someone who'll encounter them for the first time on the job.

The PDF parsing alone had three distinct failure modes — encrypted files, scanned images passed as PDFs, and malformed byte streams — each requiring a different fallback path that I designed and tested individually. The scoring pipeline runs sub-second on Vercel's Hobby tier because I kept the compute client-side until the last possible moment, only hitting the API for the irreducible inference step. Both of those constraints — reliability under malformed input and tight serverless budgets — show up verbatim in your backend JD.

Stripe's move to incremental processing at the transaction layer is the same class of problem I've been solving at the application layer: keep latency predictable, never drop data, and degrade gracefully when upstream systems fail. I'd welcome a conversation about the infrastructure engineering role."

Example B — Data/ML candidate, data pipeline JD:
"My capstone project processed 2.3 million sensor readings per day in Spark, with zero dropped records over a 90-day production run. That reliability constraint is exactly what your data engineering JD is asking someone to own — and I've already built a version of that system. [Company] gets a data engineer who treats a dropped record as a personal failure, not a metrics footnote.

The hardest part of the pipeline wasn't the volume — it was late-arriving data from sensors that would occasionally batch-deliver 4 hours of readings at once, breaking naive windowing logic. I implemented a watermark strategy that tolerated up to 6 hours of latency without sacrificing accuracy, which meant rewriting the ingestion layer mid-project after the original approach failed under real data. I also ran the entire thing on a three-node local cluster with no cloud budget, so every optimization had to pay for itself in wall-clock time.

[Company]'s infrastructure team is clearly investing in real-time pipelines given the recent engineering blog posts on stream processing at scale — that's the exact problem space I want to work in. [Company] gets someone who's already made the hard tradeoffs between latency and correctness, not someone learning them on the job. I'd welcome a conversation about the data engineering internship."`;

// ── Groq call ─────────────────────────────────────────────────────────────────

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

async function callGroq(userMessage: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const res = await withTimeout(
    fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model:       'llama-3.3-70b-versatile',
        temperature: 0.4,    // enough variance for natural phrasing, not enough to hallucinate
        max_tokens:  700,    // 3 full paragraphs need ~550-650 tokens; 700 gives headroom
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: userMessage    },
        ],
      }),
    }),
    GROQ_TIMEOUT,
    'Groq'
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Groq ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = await res.json();
  const text: string = json?.choices?.[0]?.message?.content ?? '';
  if (!text) throw new Error('Groq returned empty content');
  return text.trim();
}

// ── Paragraph splitter ────────────────────────────────────────────────────────
// Split raw text on the blank line between paragraphs.
// Handles \r\n, \n\n, and single-spaced edge cases.

function splitParagraphs(text: string): { hook: string; body: string; close: string } {
  // Split on one or more blank lines
  const parts = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 0);

  return {
    hook:  parts[0] ?? '',
    body:  parts[1] ?? '',
    close: parts[2] ?? '',
  };
}

// ── POST handler ───────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // ── Auth + access gate ─────────────────────────────────────────────────────
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json<ApplyFullError>(
        { ok: false, error: 'Authentication required.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    const hasFullAccess = dbUser ? Boolean((dbUser as Record<string, unknown>).hasFullAccess) : false;
    if (!hasFullAccess) {
      return NextResponse.json<ApplyFullError>(
        { ok: false, error: 'Full access required. Upgrade to generate cover letters.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    let body: Partial<ApplyFullRequest>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json<ApplyFullError>(
        { ok: false, error: 'Invalid JSON body.', code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    const { jd, analysis } = body;

    // Validation
    if (!jd || typeof jd !== 'string' || jd.trim().length < 50) {
      return NextResponse.json<ApplyFullError>(
        { ok: false, error: 'Job description must be at least 50 characters.', code: 'JD_TOO_SHORT' },
        { status: 422 }
      );
    }
    if (!analysis || typeof analysis !== 'object') {
      return NextResponse.json<ApplyFullError>(
        { ok: false, error: 'Missing analysis data.', code: 'NO_ANALYSIS' },
        { status: 422 }
      );
    }

    const truncatedJd = jd.slice(0, 4000);   // slightly more context than preview for body paragraph

    const strongSkills = (analysis.skills_analysis?.strong_skills ?? []).slice(0, 6).join('; ');

    const userMessage = `
CANDIDATE BACKGROUND:
- Role type: ${analysis.detected_role ?? 'SWE'}
- Project work: ${analysis.project_analysis ?? 'No project data.'}
- Work experience: ${analysis.experience_analysis ?? 'No experience data.'}
- Key strengths: ${(analysis.strengths ?? []).slice(0, 4).join('; ')}
${strongSkills ? `- Verified skills (backed by project evidence): ${strongSkills}` : ''}

JOB DESCRIPTION (first 4000 chars):
${truncatedJd}

Before writing, think through this silently:
1. P1 HOOK — pick the single most impressive, specific thing from the candidate background (a named project, a metric, a concrete outcome). Pick the ONE most specific JD requirement it maps to.
2. P2 EVIDENCE — pick TWO distinct projects or experiences from the background. For each, identify one concrete, specific detail (a number, a tradeoff, a decision). Identify which JD requirements they demonstrate.
3. P3 CLOSE — identify ONE specific thing about this company (a product, a team, a public technical decision) that the candidate's background actually positions them to contribute to.

Now write the 3 paragraphs. Follow every rule exactly. Stay ruthlessly specific.
`.trim();

    let raw: string;
    try {
      raw = await callGroq(userMessage);
    } catch (e: any) {
      console.error('apply-full Groq error:', e?.message);
      return NextResponse.json<ApplyFullError>(
        { ok: false, error: 'Cover letter generation failed. Please try again.', code: 'AI_FAILED' },
        { status: 500 }
      );
    }

    const paragraphs = splitParagraphs(raw);

    // Sanity check: if we got fewer than 3 paragraphs, something went wrong
    if (!paragraphs.hook || !paragraphs.body || !paragraphs.close) {
      console.error('apply-full: incomplete paragraphs', { hook: !!paragraphs.hook, body: !!paragraphs.body, close: !!paragraphs.close });
      return NextResponse.json<ApplyFullError>(
        { ok: false, error: 'Cover letter generation was incomplete. Please try again.', code: 'AI_INCOMPLETE' },
        { status: 500 }
      );
    }

    const cover_letter = [paragraphs.hook, paragraphs.body, paragraphs.close].join('\n\n');

    return NextResponse.json<ApplyFullSuccess>({ ok: true, cover_letter, paragraphs });

  } catch (e: any) {
    console.error('apply-full unhandled:', e?.message);
    return NextResponse.json<ApplyFullError>(
      { ok: false, error: 'Unexpected error. Please try again.', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
