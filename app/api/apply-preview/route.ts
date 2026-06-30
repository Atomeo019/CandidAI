import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export const runtime     = 'nodejs';
export const maxDuration = 10;

const GROQ_TIMEOUT = 7500;

// ── Types ─────────────────────────────────────────────────────────────────────

interface ApplyPreviewRequest {
  jd: string;
  analysis: {
    detected_role:       string;
    project_analysis:    string;
    experience_analysis: string;
    strengths:           string[];
  };
}

interface ApplyPreviewSuccess {
  ok: true;
  preview: string;   // first paragraph of the cover letter
}

interface ApplyPreviewError {
  ok: false;
  error: string;
  code: string;
}

// ── System prompt ─────────────────────────────────────────────────────────────
// Goal: a single compelling opening paragraph that hooks the recruiter.
// Rules:
//   - Never start with "I am excited to apply" or any generic opener.
//   - Lead with the most impressive, specific thing from the candidate's background.
//   - Mirror the exact language/keywords from the JD.
//   - Reference a specific project or role from the candidate data — no generics.
//   - 3-4 sentences only. Stop.

const SYSTEM_PROMPT = `You are a brutally effective career coach. Write ONLY the opening paragraph of a cover letter — exactly 3 sentences, no more, no less.

Do NOT write like a cover letter template. The best openings sound like a confident person explaining at a coffee chat — in plain, direct English — exactly why they are right for this specific role. No corporate register. No hedging. No padding.

SENTENCE 1 — THE HOOK:
Lead with the single most impressive, specific thing from this candidate's background. Start with "I" or the project name. One concrete thing — a project, a metric, an outcome.
ALLOWED: "I built X", "My X project", "After shipping X", "X cut Y by Z%", "I rewrote X and reduced Y from A to B"
BANNED (automatic failure): "With a strong", "As a [adjective]", "I am excited", "I am passionate", "I am writing to", "Having", "With my", "As someone", "Throughout my", "I have always", "demonstrates my", "demonstrating my", "showcasing my", "highlighting my", "showing my"

SENTENCE 2 — THE BRIDGE:
Look at the JD and find ONE specific requirement — a technology, a problem, a scale constraint. Look at the candidate's background and find ONE specific thing that directly matches it. Connect them in plain English. Name both explicitly. Write it like you're telling a smart friend: "oh, and that experience maps exactly to what they need because..."
BANNED (automatic failure): "aligns with the requirement of", "as specified in", "as outlined in", "meets the requirement", "as required by", "fulfills the need for", "aligns perfectly with", "directly aligns with", "is consistent with", "corresponds to"
GOOD bridge examples:
- "That same pipeline work is exactly what [Company]'s data infrastructure team is describing — processing at scale with zero tolerance for dropped records."
- "Building that meant living inside the same latency constraints your backend JD is asking someone to own."
- "That's the exact tradeoff your JD calls out — and I've already shipped a version of that solution."
- "Your JD asks for someone who can own the API layer end-to-end; that's what I did for eight months."

SENTENCE 3 — THE CLOSE:
Name the company once. Make a concrete claim about what THEY GET — not what the candidate feels, wants, or hopes. The framing is "Company gets X" not "I am confident I can Y."
BANNED (automatic failure): "I am confident I can", "I believe I can", "I look forward to", "I am excited to", "I would love to", "leverage my skills", "contribute to your team", "I am passionate about", "I hope to"
GOOD close examples:
- "[Company] gets an engineer who already knows what breaks at scale, not someone who'll discover it for the first time on the job."
- "That means [Company] gets a backend engineer who can own the data pipeline from day one, not someone who needs to be onboarded on the basics."
- "[Company] gets a frontend engineer who treats performance as a feature, not an afterthought."

ABSOLUTE RULES:
- Exactly 3 sentences. Count them. If you write 4, you failed.
- Every sentence must contain at least one specific noun from either the resume or the JD (project name, technology, company name, or metric).
- COMPANY NAME: appears in S3 ONLY. Zero mentions in S1. Zero mentions in S2. If you write the company name in S2, that sentence must be rewritten. The company name in S3 must be the very first word or two of S3 — "Company gets..." format.
- TECHNOLOGY TRUTH RULE: Do NOT name any technology (framework, language, tool, platform) that is not explicitly mentioned in the candidate background section above. If the background lists no specific tech, write around it using the project name, outcome, or metric. Naming React, Node.js, Python, or any other tech that doesn't appear in the background is an automatic failure — it is a lie on the candidate's behalf.
- Output raw text only. No JSON. No markdown. No label. No greeting. Just the 3 sentences.

EXAMPLES OF EXACTLY THE RIGHT OUTPUT (study the register and specificity):

Example A — SWE with a real project, backend role:
"I built CandidAI — an AI resume analyzer that extracts and scores PDFs end-to-end — as a solo project in four weeks, handling every layer from parsing to the React UI. That full-stack ownership is exactly what Stripe's infrastructure team is describing: someone who can ship a data pipeline without handing off at every boundary. Stripe gets an engineer who's already debugged production parsing failures, not someone who'll encounter them for the first time on the job."

Example B — Data/ML candidate, data engineering JD:
"My capstone pipeline processed 2.3 million rows of sensor data daily in Spark with zero dropped records over a 90-day production run. That's the scale and reliability problem your data engineering JD is asking someone to own — and I've already solved a version of it. [Company] gets an engineer who treats data loss as a personal failure, not a metrics footnote."

Example C — SWE intern candidate, full-stack JD:
"I rebuilt a fintech dashboard's frontend from a jQuery codebase to React and cut page load from 4.2 seconds to under 800ms without touching the backend. Your JD calls out React and performance — that combination is what I've already shipped in a production environment. [Company] gets a frontend engineer who's already made the tradeoffs between bundle size and user experience, not one who needs to learn them on your codebase."`;

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
      method: 'POST',
      headers: {
        'Authorization':  `Bearer ${apiKey}`,
        'Content-Type':   'application/json',
      },
      body: JSON.stringify({
        model:        'llama-3.3-70b-versatile',
        temperature:  0.4,   // 0.3 was producing correct-but-stiff output; 0.4 allows natural phrasing without hallucination risk
        max_tokens:   200,   // 150 was clipping S3 — 3 natural sentences need ~160-190 tokens
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

  const json  = await res.json();
  const text: string = json?.choices?.[0]?.message?.content ?? '';
  if (!text) throw new Error('Groq returned empty content');
  return text.trim();
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json<ApplyPreviewError>(
      { ok: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' },
      { status: 401 }
    )
  }

  try {
    let body: Partial<ApplyPreviewRequest>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json<ApplyPreviewError>(
        { ok: false, error: 'Invalid JSON body.', code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    const { jd, analysis } = body;

    // Validation
    if (!jd || typeof jd !== 'string' || jd.trim().length < 50) {
      return NextResponse.json<ApplyPreviewError>(
        { ok: false, error: 'Job description must be at least 50 characters.', code: 'JD_TOO_SHORT' },
        { status: 422 }
      );
    }
    if (!analysis || typeof analysis !== 'object') {
      return NextResponse.json<ApplyPreviewError>(
        { ok: false, error: 'Missing analysis data.', code: 'NO_ANALYSIS' },
        { status: 422 }
      );
    }

    const truncatedJd = jd.slice(0, 3000); // cap to control token usage

    const userMessage = `
CANDIDATE BACKGROUND:
- Role type: ${analysis.detected_role ?? 'SWE'}
- Project background: ${analysis.project_analysis ?? 'No project data.'}
- Work experience: ${analysis.experience_analysis ?? 'No experience data.'}
- Key strengths: ${(analysis.strengths ?? []).slice(0, 3).join('; ')}

JOB DESCRIPTION (first 3000 chars):
${truncatedJd}

Before writing, do this silently:
1. Pick the ONE most impressive, specific thing from the candidate background above (a named project, a metric, a concrete outcome — not a skill category).
2. Pick the ONE most specific requirement from the JD (a named technology, a scale constraint, a specific problem — not a generic skill).
3. Write the 3 sentences using those two anchors. Do not use any other background or JD content — stay specific to what you picked.

Now write the 3 sentences. Follow your rules exactly.
`.trim();

    let preview: string;
    try {
      preview = await callGroq(userMessage);
    } catch (e: any) {
      console.error('apply-preview Groq error:', e?.message);
      return NextResponse.json<ApplyPreviewError>(
        { ok: false, error: 'Cover letter generation failed. Please try again.', code: 'AI_FAILED' },
        { status: 500 }
      );
    }

    return NextResponse.json<ApplyPreviewSuccess>({ ok: true, preview });

  } catch (e: any) {
    console.error('apply-preview unhandled:', e?.message);
    return NextResponse.json<ApplyPreviewError>(
      { ok: false, error: 'Unexpected error. Please try again.', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
