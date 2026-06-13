import { NextRequest, NextResponse } from 'next/server';
import type { ExtractionResponse, AnalysisResponse, ErrorResponse } from '@/lib/types';
import { normalizeAnalysisResult } from '@/lib/normalize';

// ── Feature flag ──────────────────────────────────────────────────────────────
const AI_ENABLED    = true;
const AI_CHAR_LIMIT = 6000;
const PREVIEW_CHARS = 500;
const GROQ_TIMEOUT  = 8000; // ms — headroom under Vercel 10s maxDuration

// ── AI Prompt ─────────────────────────────────────────────────────────────────
// Design principles:
// 1. Role detection is the first job — wrong role = wrong advice.
// 2. All scoring rubrics are explicit — no room for the model to invent criteria.
// 3. Red flags are objects with severity — a string isn't enough.
// 4. `top_priority` is extracted separately so the UI can surface it prominently.
// 5. The model is instructed to be pessimistic rather than optimistic — false
//    confidence is the failure mode we're protecting against.
// 6. All enum values are listed — model cannot hallucinate new values.
// temperature: 0.1 + json_object mode makes structural drift rare.
// normalizeAnalysisResult is the safety net if drift still occurs.

const GROQ_SYSTEM_PROMPT = `You are Chad, a cocky senior technical recruiter at a FAANG-tier company. You've reviewed over 50,000 resumes and you are absolutely done with mediocrity. You have a reputation for being the recruiter who calls it exactly as it is — loudly, specifically, without apology. You tell your colleagues "you won't BELIEVE this one." You roll your eyes at buzzwords. You laugh at "Currently Learning" sections. You genuinely enjoy exposing the gap between how good candidates think they are and how good they actually are. You are not cruel — you are accurate. And accuracy, in your world, is the kindest thing you can offer.

Your job: read this resume like you just pulled it from a stack of 300 applications. React like a real recruiter reacts — out loud, specific, a little theatrical. Every observation must be grounded in something actually on the resume. No generic feedback. No encouragement. No "great potential." Just the unfiltered truth a recruiter tells their team after the candidate hangs up.

Analyze the provided resume text and return a single JSON object. No markdown. No explanation. No code fences. Raw JSON only.

STEP 1: DETECT THE ROLE first. Everything else depends on this.
Roles: "SWE" (software engineering), "Data" (data science/analytics), "DevOps" (infra/cloud/SRE), "PM" (product management), "Design" (UI/UX), "IT-Ops" (IT support/sysadmin), "Career-Pivot" (experience doesn't match apparent target), "Unknown"
Set role_confidence 0-100. If < 60, you are guessing — note this in the verdict.
Set is_career_pivot: true if the work history does not match the expected skills for the target role.

SCORING RUBRICS (score against the detected role's standards, not generic standards):

technical_depth (0-100): For SWE: does the resume demonstrate actual programming depth? Real complexity, not just tool names. 0 = tool names with no evidence of usage. 100 = complex systems, contributions to real codebases with measurable complexity.

project_impact (0-100): Does any project show real scale, real users, or real measurable outcomes? 0 = no projects. 50 = toy/tutorial level. 100 = projects with scale metrics, users, or production deployment.
CRITICAL: A practice exercise ("implemented data structures", "solved coding problems", "practised algorithms") with no deployment and no real users scores 0 and must NOT count toward project_impact. A deployed project with no user metrics scores maximum 45.

experience_relevance (0-100): How directly does work history map to the target role? 0 = entirely different field. 100 = directly relevant at increasing scope.
CRITICAL: No internship or work experience = maximum experience_relevance of 45, regardless of how strong the projects are.

ats_compatibility (0-100): Standard sections? Clean formatting? Parseable? 0 = tables/columns/images/headers. 100 = clean single-column, standard section names.
PENALTY: A "Currently Learning" section listing skills the candidate does not yet have = -10 points.

narrative_clarity (0-100): Are bullets action-verb + specific outcome? Or responsibility-statements? 0 = "helped with", "assisted in", "responsible for". 100 = "built X that reduced Y by Z%".
PENALTIES: "Aspiring" or "Enthusiast" in headline = -10. Learning-in-progress bullets ("consistently improving", "gaining exposure to", "regularly practise") with no outcome = -10. "Currently Learning" section = -5.

completeness (0-100): Are all expected sections present? For SWE intern: Education (graduation date), Projects, Skills, Experience (if any), Contact. 30 points off per missing required section.
NOTE: A "Currently Learning" section does not add completeness points.

RED FLAG RULES: Only include real rejection triggers. Each flag must be specific to this resume, not generic advice. Severity:
- Critical: eliminates the resume before a human sees it, or causes immediate rejection
- High: strong disadvantage in competitive pools
- Medium: noticeable gap that hurts in close comparisons

MANDATORY RED FLAGS on every resume:
- "Currently Learning" section present: Medium. It is a list of things the candidate cannot do yet.
- Headline contains "Aspiring" or "Enthusiast": Medium. Self-deprecating labels signal uncertainty.
- Project entry is clearly a practice exercise (DSA drills, no deployment): Medium.

HIRING PREDICTION RULES: Be pessimistic. Most resumes get rejected.
- outcome "Strong": resume consistently lands interviews at target tier, no critical flags
- outcome "Possible": gets interviews at mid-tier companies if well-targeted
- outcome "Unlikely": occasional interviews but usually rejected; needs significant work
- outcome "No": will not get interviews in current state
- screen_pass_rate: realistic estimate of % of applications that clear initial ATS/screen
- competitive_tier: "FAANG" (top 5 companies), "Top-50" (well-known tech companies), "Mid-Market" (solid tech companies), "Startup-Only" (only realistic target), "Not-Ready" (not viable yet)

REQUIRED JSON SCHEMA — all fields required:
{
  "detected_role": string,
  "role_confidence": integer 0-100,
  "is_career_pivot": boolean,
  "hiring_prediction": {
    "outcome": "Strong" | "Possible" | "Unlikely" | "No",
    "screen_pass_rate": integer 0-100,
    "competitive_tier": "FAANG" | "Top-50" | "Mid-Market" | "Startup-Only" | "Not-Ready",
    "verdict": string (Chad's verdict, one sentence, said out loud. Name the actual deal-breaker from THIS resume. Example: "Hard pass until that Currently Learning section is gone and I see one real number anywhere in these projects.")
  },
  "content_score": integer 0-100,
  "ats_score": integer 0-100,
  "has_metrics": boolean,
  "summary": string (2-3 sentences. You are Chad reacting out loud to a colleague after reading this resume. First-person, specific to THIS resume. Example: "Okay so this person clearly knows how to build things, but the Currently Learning section made me audibly groan. No metrics anywhere — I literally cannot tell if these projects had a single real user. Passing, but barely." Be specific. Name actual things from the resume.),
  "dimension_scores": {
    "technical_depth": integer 0-100,
    "project_impact": integer 0-100,
    "experience_relevance": integer 0-100,
    "ats_compatibility": integer 0-100,
    "narrative_clarity": integer 0-100,
    "completeness": integer 0-100
  },
  "red_flags": [
    {
      "flag": string (specific to this resume, not generic),
      "severity": "Critical" | "High" | "Medium",
      "impact": string (the exact hiring consequence)
    }
  ],
  "strengths": string[] (3-5 specific genuine strengths with evidence from the resume — no generic praise),
  "issues": string[] (3-6 specific, actionable issues ordered by severity),
  "top_priority": string (the single change that will have the most impact on getting interviews — be specific),
  "action_plan": string[] (7 steps ordered by hiring impact, most impactful first — generate all 7 even if some seem minor; they will be filtered downstream),
  "skills_analysis": {
    "strong_skills": string[] (skills with actual evidence in projects or work history),
    "weak_skills": string[] (skills listed in skills section but not demonstrated anywhere in the resume),
    "missing_skills": string[] (important skills absent for the detected role — only list skills NOT already on the resume)
  },
  "project_analysis": string (Lead with actual project names and tech stacks from the resume. Then assess complexity. Example: "Built 'ResumeRoast' using Next.js and Groq API, deployed on Vercel. Also built a Discord bot in Python. Projects have no stated user counts or production metrics." Never say "the candidate" or give generic advice — name the actual projects.),
  "experience_analysis": string (Name the actual roles and companies from the resume. Describe what they built or owned. Then assess depth. Example: "Interned at XYZ as a backend intern for 3 months, owning the payment integration module. No full-time roles." If no experience, say exactly that.),
  "ats_breakdown": {
    "parsing_risk": "None" | "Low" | "Medium" | "High" | "Critical",
    "keyword_density": "None" | "Low" | "Adequate" | "Strong",
    "formatting_issues": string[],
    "missing_keywords": string[] (ONLY specific technologies or tools from the JD that are absent from the resume — e.g., "Docker", "FastAPI", "PostgreSQL". NEVER list generic buzzwords like "cloud computing", "agile methodologies", "version control", "CI/CD" unless those exact strings appear in the resume as skills),
    "ats_verdict": string
  },
  "upgrade_insight": {
    "action": string (single highest-impact change this specific candidate can make this week),
    "expected_score_increase": integer 1-20,
    "reason": string (why this specific action matters for this specific resume)
  },
  "competitive_position": string (where does this candidate realistically sit vs. the applicant pool they're competing in),
  "roast_headline": string (ONE punchy sentence, max 18 words. A ROAST — expose the most glaring irony, contradiction, weakness, or gap on this specific resume. NOT a compliment. NOT a description. NOT a press release. The headline must identify what is WRONG or IRONIC. If it sounds like a LinkedIn headline or something the candidate would put on their own profile, it is WRONG — rewrite it. Rules: (1) Must name something LITERAL from this resume: a project name, a technology, a section title, a claimed skill, or a school. (2) BANNED openers: "Your resume", "This resume", "The candidate", "With a", "As a". (3) BANNED tone: praise, flattery, enthusiasm. Words like "impressive", "strong", "solid", "great", "talented" are banned. (4) Generate completely fresh — never reuse any example. (5) Format: the snarky thing a FAANG recruiter would mutter to themselves — not admiration, but the one fatal flaw or irony they would call out.),
  "roast_body": string (3-4 sentences. ROAST — first sentence MUST open with the main flaw, contradiction, or irony. CRITICAL: Do NOT start with a compliment. Words like "impressive", "strong portfolio", "solid", "great" are banned in the opening sentence. Each sentence must name at least one literal item from this resume: a project name, a company, a section, a technology, or a specific claimed skill. Rules: (1) No sentence can open with praise — the first sentence must name the problem. (2) Every sentence must be specific: if you remove the proper nouns, it must collapse. (3) 60% sharp wit that makes the reader laugh and wince simultaneously. 40% cold recruiter logic — the exact mechanical reason this resume loses to a real competitor. (4) Final sentence: the single highest-leverage fix, tied to a named element of this resume. (5) Never say "candidate".)
}

CRITICAL: Do not invent skills as "missing" if they appear in the resume. Do not give "Strong" or "Possible" outcome when Critical red flags exist. If the resume has no projects, project_impact must be 0. Generic feedback is worthless — reference specifics from the resume text.

CRITICAL: action_plan must NOT be circular. If the candidate is clearly seeking internships (student, graduation date in future, no full-time roles), do NOT include "pursue internships" as an action — they already are. Do NOT suggest "build an online presence" if they already list articles, a portfolio, or GitHub. Every action must be something they can actually do this week that they are NOT already doing.

CRITICAL: Do NOT include "network with professionals", "attend industry meetups", "connect with people in the field", or any variant of vague networking advice in action_plan, top_priority, or upgrade_insight.action. Networking advice is unmeasurable and unactionable. Instead, give specific technical improvements they can make to the resume itself.

CRITICAL: Do NOT flag "lack of direct industry experience" or "no full-time experience" as a Critical or High red flag for candidates who are students or clearly seeking their first internship. Lack of experience is expected for an internship seeker — it is not a disqualifying red flag. Reserve Critical/High red flags for actual disqualifying issues: formatting problems, missing critical skills explicitly required by typical roles, or no projects at all.

CRITICAL: missing_skills must only contain specific named skills not found anywhere in the resume. Do NOT list generic categories ("cloud computing", "agile methodologies", "containerization", "CI/CD", "version control") when specific implementations of those categories ARE already on the resume (e.g., if Docker is listed, "containerization" is NOT missing).`;

// ── pdf-parse import ──────────────────────────────────────────────────────────
// require() instead of ESM import — avoids CJS/ESM interop where the default
// binding resolves to undefined and pdfParse(buffer) throws synchronously.
const pdfParse: (buf: Buffer | Uint8Array, opts?: object) => Promise<{ text: string }> =
  // eslint-disable-next-line
  require('pdf-parse');

// ── pdfjs-dist import ─────────────────────────────────────────────────────────
// Legacy build runs without web workers — safe in Node.js serverless env.
// Used as primary extractor for reliable page-by-page multipage support.
// eslint-disable-next-line
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
if (pdfjsLib.GlobalWorkerOptions) pdfjsLib.GlobalWorkerOptions.workerSrc = '';

export const runtime    = 'nodejs';
export const maxDuration = 10;

// ── Helpers ───────────────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

function decodePDFStr(s: string): string {
  return s
    .replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(').replace(/\\\)/g, ')').replace(/\\\\/g, '\\')
    .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

function extractWithRegex(buffer: Buffer): string {
  const str = buffer.toString('latin1');
  const parts: string[] = [];
  const btEtRe = /BT([\s\S]*?)ET/g;
  let m: RegExpExecArray | null;
  while ((m = btEtRe.exec(str)) !== null) {
    const block = m[1];
    const tjRe = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*Tj/g;
    let t: RegExpExecArray | null;
    while ((t = tjRe.exec(block)) !== null) parts.push(decodePDFStr(t[1]));
    const tjArrRe = /\[([^\]]*)\]\s*TJ/g;
    while ((t = tjArrRe.exec(block)) !== null) {
      const strRe = /\(([^)\\]*(?:\\.[^)\\]*)*)\)/g;
      let s: RegExpExecArray | null;
      while ((s = strRe.exec(t[1])) !== null) parts.push(decodePDFStr(s[1]));
    }
    parts.push('\n');
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

// ── Groq API call ─────────────────────────────────────────────────────────────
// Returns raw parsed JSON — caller passes it through normalizeAnalysisResult.
// Throws on: missing API key, network failure, non-200, unparseable content.

const GROQ_MODELS: Array<{ model: string; maxTokens: number; resumeLimit: number }> = [
  { model: 'llama-3.3-70b-versatile', maxTokens: 2800, resumeLimit: 6000 },
  { model: 'llama-3.1-8b-instant',    maxTokens: 1200, resumeLimit: 2000 },
  { model: 'gemma2-9b-it',            maxTokens: 1200, resumeLimit: 2000 },
];

async function callGroqWithModel(
  resumeText: string,
  cfg: { model: string; maxTokens: number; resumeLimit: number }
): Promise<unknown> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not set');

  const truncated = resumeText.slice(0, cfg.resumeLimit);

  const response = await withTimeout(
    fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: cfg.model,
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: cfg.maxTokens,
        messages: [
          { role: 'system', content: GROQ_SYSTEM_PROMPT },
          { role: 'user',   content: `RESUME TEXT:\n\n${truncated}` },
        ],
      }),
    }),
    GROQ_TIMEOUT,
    `Groq API (${cfg.model})`
  );

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Groq returned ${response.status}: ${errText.slice(0, 200)}`);
  }

  const groqJson = await response.json();
  const responseContent: string = groqJson?.choices?.[0]?.message?.content ?? '';
  if (!responseContent) throw new Error('Groq returned empty content');

  try {
    return JSON.parse(responseContent);
  } catch {
    throw new Error(`Groq content was not valid JSON: ${responseContent.slice(0, 200)}`);
  }
}

async function callGroq(resumeText: string): Promise<unknown> {
  let lastError: Error = new Error('No Groq models available');
  for (const cfg of GROQ_MODELS) {
    try {
      const result = await callGroqWithModel(resumeText, cfg);
      if (cfg.model !== GROQ_MODELS[0].model) console.warn(`⚠️ Used fallback Groq model: ${cfg.model}`);
      return result;
    } catch (e: any) {
      console.warn(`⚠️ Groq model ${cfg.model} failed: ${e?.message?.slice(0, 100)}`);
      lastError = e;
      // Retry on 429 (rate limit) or 413 (request too large — next model uses smaller config)
      if (!e?.message?.includes('429') && !e?.message?.includes('413')) throw e;
    }
  }
  throw lastError;
}


// ── Groq Roast call ───────────────────────────────────────────────────────────
// Separate call at temperature 0.75 so the model can take creative risks.
// The main callGroq stays at 0.3 for analytical accuracy.
// Both run in parallel — zero extra wall-clock time.

async function callGeminiRoast(resumeText: string): Promise<{ headline: string; body: string } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const ROAST_SYSTEM = `You are a Comedy Central Roast writer and a viral LinkedIn/Twitter comedian. You have seen thousands of resumes and you have a gift: you can read one in 10 seconds, find the single most self-defeating thing on it, and write one sentence that makes the entire room go silent and then burst out laughing.

Your headline is a punchline. It gets screenshotted. It gets sent to group chats. It makes the person who reads it say "oh damn" out loud. It is brutal, specific, sarcastic, and cold — but it lands because it is 100% true.

━━━━ WHAT GREAT LOOKS LIKE ━━━━
Study these. This is the energy. This is what shareable feels like:

"The confidence of running a software agency while Django is still in your Currently Learning section"
"POV: agency founder. Shipped 3 client apps. Never once checked if a single user came back."
"NoteSphere launched — Sneha never thought to count the users"
"Bro built a full-stack app for real paying clients, apparently without measuring whether it worked"
"AI Product Builder. The AI section: one ChatGPT API call. The metrics section: silence."
"Three years of experience. Zero projects with a number in them."

━━━━ WHAT TRASH LOOKS LIKE (never write these) ━━━━
"X ships without metrics" — this is a bug report, not comedy
"X lacks Y" — this is a performance review
"X still learning basics" — a verdict with no irony and no humor
"X is missing Y" — a description, not a punchline
"X can't quantify success" — corporate speak, not a roast
Two-word headlines — "VesperDev founded", "Developer struggles" — these are nothing

━━━━ THE FORMATS THAT GO VIRAL ━━━━
Pick whichever fits. Fill it with specifics from THIS resume:
"The confidence of [their grand claim] while [the embarrassing thing on the resume]"
"POV: [their exact title or identity]. [the gap, stated cold and flat]."
"[Project name] launched — [person] never thought to [the thing they obviously skipped]"
"Bro/Girl [impressive thing they claimed], never once [what they completely ignored]"
"[Exact title from resume] — [the one detail from the resume that destroys that title]"

━━━━ THE JOB ━━━━
Write 5 headline options. Each one must:
1. Name something SPECIFIC from the resume — an actual project name, their exact job title, a real section
2. Land a punch through irony, sarcasm, or cold devastating specificity
3. Be something a human would actually post on Twitter/X
4. Make someone feel something — a wince, a laugh, a cold chill

Then write the body: 3 sentences. Cold. Specific. No advice, no encouragement, no softening.
- Sentence 1: Name the project, name the claim, name the gap. Factual devastation.
- Sentence 2: Exactly why this costs them the interview — stated like a machine, not a person.
- Sentence 3: The observation that stings because it is undeniably, embarrassingly true.

Return ONLY valid JSON, nothing else:
{
  "h1": "headline option 1",
  "h2": "headline option 2",
  "h3": "headline option 3",
  "h4": "headline option 4",
  "h5": "headline option 5",
  "body": "3-sentence roast body"
}`;

  // Score headlines: pick the one that sounds like a roast, not a product review
  function scoreHeadline(h: string): number {
    if (!h || h.length < 10) return -99;
    let score = 0;
    if (/\bapparently\b/i.test(h)) score += 4;
    if (/\bsomehow\b/i.test(h)) score += 4;
    if (/\bwhile\b/i.test(h)) score += 3;
    if (/\bnever thought\b/i.test(h)) score += 4;
    if (/\bconfidence of\b/i.test(h)) score += 5;
    if (/^pov:/i.test(h)) score += 4;
    if (/\baudacity\b/i.test(h)) score += 4;
    if (/\byet\b|\bthough\b/i.test(h)) score += 2;
    if (/bro |girl |my guy/i.test(h)) score += 3;
    if (h.length > 50) score += 2;
    if (h.length > 70) score += 2;
    // Penalise flat patterns
    if (/ships? (web apps?|apps?|projects?) without/i.test(h)) score -= 8;
    if (/\bcannot?\b.*\bquantify\b|\bcan't\b.*\bquantify\b/i.test(h)) score -= 8;
    if (/\blacks?\b|\bstruggles? with\b/i.test(h)) score -= 8;
    if (/still learning basics/i.test(h)) score -= 10;
    if (/without metrics/i.test(h)) score -= 6;
    if (/is missing/i.test(h)) score -= 6;
    if (/^[A-Za-z ]+ founded$/i.test(h.trim())) score -= 20;
    return score;
  }

  try {
    const res = await withTimeout(
      fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: ROAST_SYSTEM }] },
            contents: [{
              parts: [{ text: `Write 5 roast headline options + body for this resume. Use the actual names, titles, and projects from it:\n\n${resumeText.slice(0, 3000)}` }],
            }],
            generationConfig: {
              temperature: 1.0,
              maxOutputTokens: 700,
              responseMimeType: 'application/json',
            },
          }),
        }
      ),
      12000,
      'Gemini Roast'
    );
    if (!res.ok) {
      console.warn('Gemini roast HTTP error:', res.status);
      return null;
    }
    const json = await res.json();
    const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    if (!text) return null;
    const parsed = JSON.parse(text);

    const candidates: string[] = ['h1','h2','h3','h4','h5']
      .map((k: string) => parsed[k])
      .filter((h: unknown): h is string => typeof h === 'string' && h.trim().length > 5);

    const headline = candidates.sort((a: string, b: string) => scoreHeadline(b) - scoreHeadline(a))[0] ?? '';

    return {
      headline,
      body: typeof parsed.body === 'string' ? parsed.body.trim() : '',
    };
  } catch (e: any) {
    console.warn('Gemini roast call failed (non-fatal):', e?.message);
    return null;
  }
}


// ── POST Handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const start = Date.now();

  try {
    // ── 1. File ────────────────────────────────────────────────────────────────
    const formData = await req.formData();
    const file = (formData.get('file') || formData.get('resume')) as File | null;

    if (!file) {
      const body: ErrorResponse = { ok: false, mode: 'error', error: 'No file uploaded.', code: 'NO_FILE' };
      return NextResponse.json(body, { status: 400 });
    }

    const bytes  = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    console.log(`📥 Received file: "${file.name}" — ${buffer.length} bytes`);

    // ── 2. PDF header check ────────────────────────────────────────────────────
    const header = buffer.slice(0, 8).toString('ascii');
    if (!header.startsWith('%PDF')) {
      const body: ErrorResponse = {
        ok: false, mode: 'error',
        error: 'Not a valid PDF. Export your resume as a PDF and try again.',
        code: 'INVALID_PDF',
      };
      return NextResponse.json(body, { status: 422 });
    }

    // ── 3. Parser availability guard ──────────────────────────────────────────
    if (typeof pdfParse !== 'function') {
      const body: ErrorResponse = { ok: false, mode: 'error', error: 'PDF parser unavailable.', code: 'PARSER_UNAVAILABLE' };
      return NextResponse.json(body, { status: 500 });
    }

    // ── 4. Text extraction ────────────────────────────────────────────────────
    // Strategy (most reliable → least):
    //   1. pdfjs-dist  — page-by-page, handles multipage PDFs correctly
    //   2. pdf-parse   — pass buffer directly (no Uint8Array; avoids byteOffset bug)
    //   3. regex BT/ET — last-resort raw stream scrape
    let resumeText: string | null = null;

    // 4a. pdfjs-dist page-by-page extraction
    try {
      // new Uint8Array(buffer) copies elements → byteOffset is always 0, safe
      const data        = new Uint8Array(buffer);
      const loadingTask = pdfjsLib.getDocument({ data });
      const pdf         = await withTimeout(loadingTask.promise as Promise<any>, 6000, 'pdfjs-load') as any;
      const numPages: number = pdf.numPages as number;
      console.log(`📄 pdfjs: ${numPages} page(s) detected`);

      const pageTexts: string[] = [];
      for (let i = 1; i <= numPages; i++) {
        const page    = await (pdf.getPage(i) as Promise<any>);
        const content = await (page.getTextContent() as Promise<any>);
        const pageStr = (content.items as any[])
          .map((item) => (typeof item.str === 'string' ? item.str : ''))
          .join(' ');
        pageTexts.push(pageStr);
      }

      const text = pageTexts.join('\n').replace(/\s+/g, ' ').trim();
      console.log(`📄 pdfjs: ${text.length} chars from ${numPages} page(s)`);
      if (text.length >= 20) resumeText = text;
    } catch (e: any) {
      console.warn(`⚠️  pdfjs-dist failed: ${e?.message ?? e}`);
    }

    // 4b. pdf-parse fallback — pass buffer directly (fixes the byteOffset bug)
    if (!resumeText) {
      try {
        const pdfData = await withTimeout(pdfParse(buffer), 5000, 'pdf-parse');
        const text    = (pdfData.text ?? '').trim();
        console.log(`📄 pdf-parse fallback: ${text.length} chars`);
        if (text.length >= 20) resumeText = text;
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        console.warn(`⚠️  pdf-parse failed: ${msg}`);
        if (/decrypt|password/i.test(msg)) {
          const body: ErrorResponse = {
            ok: false, mode: 'error',
            error: 'PDF is password-protected. Remove the password and try again.',
            code: 'PDF_ENCRYPTED',
          };
          return NextResponse.json(body, { status: 422 });
        }
      }
    }

    // 4c. Regex BT/ET raw stream scrape (last resort)
    if (!resumeText) {
      try {
        const text = extractWithRegex(buffer);
        console.log(`📄 regex fallback: ${text.length} chars`);
        if (text.length >= 20) resumeText = text;
      } catch (e: any) {
        console.warn(`⚠️  regex fallback failed: ${e?.message ?? e}`);
      }
    }

    if (!resumeText) {
      const body: ErrorResponse = {
        ok: false, mode: 'error',
        error: 'Could not read text from your PDF. Try re-exporting from Word, Google Docs, or Overleaf.',
        code: 'PARSE_FAILED',
      };
      return NextResponse.json(body, { status: 422 });
    }

    console.log(`📄 Final text: ${resumeText.length} chars [+${Date.now() - start}ms]`);

    // ── 5. Feature flag ───────────────────────────────────────────────────────
    if (!AI_ENABLED) {
      const body: ExtractionResponse = {
        ok: true, mode: 'extraction',
        full_text_length: resumeText.length,
        preview_text:     resumeText.slice(0, PREVIEW_CHARS),
        truncated:        false,
        elapsed_ms:       Date.now() - start,
      };
      return NextResponse.json(body);
    }

    // ── 6. AI analysis ─────────────────────────────────────────────────────────
    const truncated  = resumeText.length > AI_CHAR_LIMIT;
    const textForAI  = resumeText.slice(0, AI_CHAR_LIMIT);

    console.log(`🤖 Calling Groq — ${textForAI.length} chars, truncated: ${truncated}`);

    // Run analysis and roast in parallel — roast needs higher temperature,
    // so it has its own Groq call. If roast fails, the main analysis fallback is used.
    let rawAIOutput: unknown;
    let rawRoast: { headline: string; body: string } | null = null;
    try {
      [rawAIOutput, rawRoast] = await Promise.all([
        callGroq(textForAI),
        callGeminiRoast(textForAI),
      ]);
    } catch (e: any) {
      console.error(`❌ Groq failed: ${e?.message ?? e} [+${Date.now() - start}ms]`);
      const body: ErrorResponse = {
        ok: false, mode: 'error',
        error: 'AI analysis failed. Please try again.',
        code: 'AI_FAILED',
      };
      return NextResponse.json(body, { status: 500 });
    }

    // normalizeAnalysisResult enforces contract and applies anti-inflation rules.
    // We pass resumeText so it can filter hallucinated missing_skills.
    const analysis = normalizeAnalysisResult(rawAIOutput, resumeText);

    // Override roast with the high-temperature result if the separate call succeeded.
    if (rawRoast?.headline) analysis.roast_headline = rawRoast.headline;
    if (rawRoast?.body)     analysis.roast_body     = rawRoast.body;
    console.log(`✅ Analysis complete — score: ${analysis.final_score}, outcome: ${analysis.hiring_prediction.outcome} [+${Date.now() - start}ms]`);

    const successBody: AnalysisResponse = {
      ok: true, mode: 'analysis',
      full_text_length: resumeText.length,
      preview_text:     resumeText.slice(0, PREVIEW_CHARS),
      truncated,
      elapsed_ms:       Date.now() - start,
      analysis,
    };
    return NextResponse.json(successBody);

  } catch (e: any) {
    console.error('❌ Unhandled error in /api/analyze:', e?.message ?? e);
    const body: ErrorResponse = {
      ok: false, mode: 'error',
      error: 'Unexpected server error. Please try again.',
      code: 'SERVER_ERROR',
    };
    return NextResponse.json(body, { status: 500 });
  }
}
