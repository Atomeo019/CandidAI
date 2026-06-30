import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import type { ExtractionResponse, AnalysisResponse, ErrorResponse } from '@/lib/types';
import { normalizeAnalysisResult } from '@/lib/normalize';

// ── Feature flag ──────────────────────────────────────────────────────────────
const AI_ENABLED    = true;
const AI_CHAR_LIMIT = 6000;
const PREVIEW_CHARS = 500;
const GROQ_TIMEOUT  = 5500; // ms — Stage1(5.5s) + Stages2&3 parallel(2.5s) = 8s total, under Vercel 10s limit

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
  "project_analysis": string (Lead with actual project names and tech stacks from the resume. Then assess complexity. Example: "Built 'CandidAI' using Next.js and Groq API, deployed on Vercel. Also built a Discord bot in Python. Projects have no stated user counts or production metrics." Never say "the candidate" or give generic advice — name the actual projects.),
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
  "roast_body": string (3 sentences. GORDON RAMSAY ENERGY -- ruthless hiring manager, 50,000 resumes reviewed, zero patience left. Not cruel -- precise. Every sentence names something LITERAL from this resume: an actual project name, a real section title, a specific technology, a verbatim job title, or a named company. SENTENCE 1: Open cold with the single most embarrassing gap, contradiction, or irony on this resume. Name it by its actual name. No compliments, no softening, no "while X is good". State what is wrong the way a doctor states a diagnosis -- flat, specific, unavoidable. SENTENCE 2: The exact mechanical reason this resume loses in screening vs. a real competitor -- not vague advice, the specific named thing on this resume that costs them the interview. State it like a fact, not a suggestion. SENTENCE 3: The one surgical fix that would change the outcome -- tied to a literal named element on this resume. Delivered like a verdict, not a career coaching tip. HARD BANS -- any sentence containing these words gets rewritten: impressive, solid, strong, great, potential, interesting, good foundation, "candidate", "they", "the applicant", "the author", "the resume shows". GENERIC TEST: Remove all proper nouns from each sentence. If it still reads as a critique of any resume, it is too generic -- rewrite it.),
  "roast_targets": string[] (EXACTLY 2-3 items. Each is a SHORT VERBATIM FRAGMENT from this specific resume that a recruiter would cringe at — the specific detail that makes this resume uniquely mockable. Priority: (1) the exact job title or headline if it says Aspiring or Enthusiast, (2) items listed under a Currently Learning section — list them as "Currently Learning: [skill]", (3) a project name and its worst gap in 6 words or less like "NoteSphere: deployed, zero metrics stated", (4) a specific skill listed under Skills with zero evidence of use anywhere else in the resume. Requirements: each item must be 3-12 words extracted verbatim or near-verbatim. Never paraphrase — use the actual text. Example output: ["Title: Aspiring Software Developer", "Currently Learning: Django", "NoteSphere: deployed, no user count stated"])
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

// ── Template Library ────────────────────────────────────────────────────────────────────────────
// Human-written roast templates. selectTemplate() picks a category deterministically
// from roast_targets[]. Stage 2 fills {SLOT} placeholders at temp 0.7.

type RoastTemplate = { template: string; category: string };

const CL_TEMPLATES: string[] = [
  // CL-1 (v4 CL-04 💀💀) -- collision format
  `Currently Learning: {COURSE}. Currently Applying: {TITLE}. Currently: unaware these two sentences cancel each other out.`,
  // CL-2 (v4 CL-03 💀💀💀) -- THE plan is in the resume
  `Shipped {PROJECT}. Listed {COURSE} as Currently Learning. Applied for {TITLE} anyway. The plan is to learn it after getting hired. This plan is in the resume.`,
  // CL-3 (v4 CL-10 💀💀💀) -- growth mindset satire
  `Demonstrates exceptional growth mindset by applying for a {TITLE} role while actively learning {COURSE} — the skill the {TITLE} role requires. Open to feedback.`,
  // CL-4 (v4 CL-07 💀💀) -- YouTube thumbnail
  `'Currently Learning: {COURSE}' translates to: 'I know {COURSE} exists, I've seen the thumbnail of a YouTube tutorial about it, and I believe that counts.' It does not count.`,
  // CL-5 (v4 CL-08 💀💀) -- bro is at peace
  `Bro put '{COURSE}: Currently Learning' on a {TITLE} application. The {TITLE} role requires {COURSE}. Bro submitted it anyway. Bro is at peace with this.`,
  // CL-6 (v4 CL-06 💀💀) -- interview question, plan ends here
  `{PROJECT}: shipped. {COURSE}: currently learning. Interview question: 'Walk me through your experience with {COURSE}.' This is where the plan ends.`,
  // CL-7 (v4 CL-02 💀💀) -- coffee down
  `Somewhere a hiring manager just read 'Currently Learning: {COURSE}' on a {TITLE} application and put their coffee down.`,
  // CL-8 (v4 CL-09) -- genuine question
  `The job requires {COURSE}. The resume says 'Currently Learning: {COURSE}.' What was the plan here? This is a genuine question.`,
  // CL-9 (NEW -- 2026 ATS vs human trend)
  `The ATS passed this resume. Then a human read 'Currently Learning: {COURSE}.' The ATS does not have feelings. The hiring manager does.`,
  // CL-10 (NEW -- clean deadpan, opposite format)
  `'Currently Learning: {COURSE}.' '{TITLE} experience required.' Both sentences are on this resume. One of them is a job requirement. The other is its opposite.`,
];

const AT_TEMPLATES: string[] = [
  // AT-1 (v4 AT-02 💀💀💀 BEST IN LIBRARY) -- knife fight
  `Applying for a {TITLE} role. Title on the resume: 'Aspiring {TITLE}.' This is the job hunting equivalent of showing up to a knife fight holding a drawing of a knife.`,
  // AT-2 (v4 AT-07 💀💀💀) -- driver's license
  `'Aspiring {TITLE}' is the professional equivalent of writing 'aspiring adult' on your driver's license application. The goal is understood. The timing is the issue.`,
  // AT-3 (v4 AT-04 💀💀) -- bro x47
  `Bro put 'Aspiring {TITLE}' at the top of a {TITLE} job application and hit send. 47 times. Bro is living entirely by his own rules.`,
  // AT-4 (v4 AT-03 💀💀) -- edit history would be revealing
  `Most people delete 'Aspiring' before submitting. This resume kept it. In the header. In bold. The edit history on this document would be very revealing.`,
  // AT-5 (v4 AT-06 💀💀) -- recruiter closed laptop
  `Somewhere a recruiter opened this resume, read 'Aspiring {TITLE},' and had to close their laptop for five minutes. They came back. They read the rest. They're still processing.`,
  // AT-6 (v4 AT-05 💀💀) -- manifesting or misunderstanding
  `Passionate about becoming a {TITLE}. Currently not a {TITLE}. Applying to {TITLE} roles anyway. This is either manifesting or a misunderstanding of how hiring works. The resume does not clarify.`,
  // AT-7 (v4 AT-10 💀💀) -- climbing out of those two words
  `This resume opens with 'Aspiring {TITLE}.' Every sentence after that is trying to climb out of those two words. Some of them make it. Most don't.`,
  // AT-8 (v4 AT-08) -- gap is the entire interview process
  `Job title: Aspiring {TITLE}. Position applied for: {TITLE}. Gap between these two facts: the entire interview process.`,
  // AT-9 (NEW) -- Step 2 was attempted
  `Step 1: become a {TITLE}. Step 2: get hired as a {TITLE}. Step 1 was skipped. Step 2 was attempted. This is the resume from Step 2.`,
  // AT-10 (NEW) -- it was a choice. in writing. sent.
  `'Aspiring {TITLE}' was the chosen opening. Not 'Junior {TITLE}.' Not 'Entry-Level {TITLE}.' Aspiring. It was a choice. In writing. On a job application. Sent.`,
];

const NM_TEMPLATES: string[] = [
  // NM-1 (v4 NM-06 💀💀💀 THE server loneliness -- full version)
  `Imagine being the {PROJECT} server. Deployed. Fully operational. Zero confirmed users. Just the developer. Every day. Checking if it's still up.`,
  // NM-2 (v4 NM-08 💀💀) -- food blogger, no receipts
  `This resume describes {PROJECT} the same way a food blogger describes a meal they didn't finish. Beautifully written. No receipts.`,
  // NM-3 (v4 NM-02 💀💀) -- receipts are in the mail
  `Shipped {PROJECT}. Users: undisclosed. Revenue: undisclosed. Impact: described as significant. The receipts are in the mail.`,
  // NM-4 (v4 NM-10 💀💀 + kicker) -- bro thought he cooked
  `Bro deployed {PROJECT}, documented zero metrics, and submitted this to real companies. Bro thought he cooked. The metrics disagree.`,
  // NM-5 (v4 NM-01 💀💀) -- 'deployed' doing unreasonable work
  `The word 'deployed' is doing an unreasonable amount of work in this sentence.`,
  // NM-6 (v4 NM-03) -- CRUD app with no documented users
  `'{PROJECT}: A full-stack application' is one way to describe a CRUD app with no documented users.`,
  // NM-7 (v4 NM-04 💀💀) -- whatever this is, it is brave
  `{PROJECT}: deployed. Users: theoretical. The application was submitted anyway. Whatever this is, it is brave.`,
  // NM-8 (v4 NM-07 💀💀) -- repetition format, PROJECT stated
  `Projects: {PROJECT}. Users of {PROJECT}: not stated. Revenue from {PROJECT}: not stated. Impact of {PROJECT}: described as significant. '{PROJECT}': stated.`,
  // NM-9 (NEW -- GitHub reality check, 2025 specific)
  `{PROJECT} has a GitHub link. The GitHub link has zero stars. The README has four lines. The resume calls this 'deployed to production.' The word 'production' is working very hard right now.`,
  // NM-10 (v4 NM-09 upgraded) -- most confident framing
  `'{PROJECT}: built and deployed' is the most confident possible framing of a project that has never been used by anyone who wasn't also the one who built it.`,
];

const CA_TEMPLATES: string[] = [
  // CA-1 (v4 CA-01 💀💀) -- listed voluntarily (full version)
  `'{TARGET_1}' appears on this resume. It was not discovered during a background check. It was listed voluntarily.`,
  // CA-2 (v4 CA-02 💀💀💀) -- loading screen
  `{PROJECT}: shipped. {COURSE}: in progress. {TITLE}: current status. This resume is a loading screen.`,
  // CA-3 (v4 CA-04 💀💀) -- cannot take it back
  `This resume was submitted to real companies by a real person who looked at it, nodded, and pressed send. That moment happened. We cannot take it back.`,
  // CA-4 (v4 CA-07 💀💀💀) -- room got very quiet
  `A recruiter opened this resume and found {TARGET_1}. Then they found {TARGET_2}. Then the room got very quiet.`,
  // CA-5 (v4 CA-03 💀💀) -- close enough
  `{PROJECT}: shipped. {COURSE}: still buffering. This is the resume of someone who looked at an incomplete timeline and said 'close enough.'`,
  // CA-6 (v4 CA-08 💀💀) -- mood board formatted as PDF
  `This is not a professional document. This is a mood board. {PROJECT} is on it. {COURSE} is on it. Someone formatted it as a PDF and called it done.`,
  // CA-7 (v4 CA-06 💀💀) -- bro, they will have notes
  `Bro put '{TARGET_1}' AND '{TARGET_2}' on the same resume and submitted it to real companies. The companies are reviewing it now. They will have notes.`,
  // CA-8 (v4 CA-09 💀💀💀) -- LinkedIn satire + open to relocation
  `Excited to leverage synergistic growth opportunities while Currently Learning {COURSE} and having Deployed {PROJECT} with no documented impact. Open to relocation.`,
  // CA-9 (NEW) -- two people who have never met
  `The skills section made a promise. The projects section made a different promise. This is the resume of two people who have never met and have been accidentally combined into one document.`,
  // CA-10 (NEW) -- recruiter dinner story
  `{TARGET_1}: listed. {TARGET_2}: also listed. The recruiter reviewing this has already read 200 resumes today. This one just became the story they tell at dinner.`,
];

function selectTemplate(targets: string[]): RoastTemplate {
  const combined = targets.join(' ').toLowerCase();
  if (combined.includes('currently learning:')) {
    return { template: CL_TEMPLATES[Math.floor(Math.random() * CL_TEMPLATES.length)], category: 'A' };
  }
  if (combined.includes('aspiring') || combined.includes('enthusiast')) {
    return { template: AT_TEMPLATES[Math.floor(Math.random() * AT_TEMPLATES.length)], category: 'C' };
  }
  if (
    combined.includes('no metric') || combined.includes('zero metric') ||
    combined.includes('no user')    || combined.includes('zero user')   ||
    combined.includes('no documented') || combined.includes('not stated')
  ) {
    return { template: NM_TEMPLATES[Math.floor(Math.random() * NM_TEMPLATES.length)], category: 'B' };
  }
  return { template: CA_TEMPLATES[Math.floor(Math.random() * CA_TEMPLATES.length)], category: 'F' };
}


// ── Groq Roast: Stage 2 ───────────────────────────────────────────────────────
// Tiny dedicated call for the roast one-liner. Separate from main analysis so
// we can use high temp (creativity) without risking JSON drift in the main call.
// Input: roast_targets array from Stage 1 (specific verbatim resume facts).
// Output: one savage sentence, max 150 chars. Returns null on any failure.

async function callGroqRoast(targets: string[], selectedTemplate: string): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || targets.length === 0) return null;

  const targetList = targets.map((t, i) => `${i + 1}. "${t}"`).join('\n');

  try {
    const res = await withTimeout(
      fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          temperature: 0.3,
          max_tokens: 100,
          messages: [
            {
              role: 'system',
              content: `You are a slot-filling assistant with one job: complete a pre-written roast template by replacing every {SLOT} placeholder with the matching resume fact.

Return ONLY the completed sentence. No surrounding quotes. No preamble. No explanation. Just the sentence.

SLOT MAPPING:
{PROJECT}  = the project name only (e.g. "NoteSphere", "TaskFlow") — 1-2 words, never a description
{COURSE}   = the core skill only from a "Currently Learning:" fact — 1-3 words max
{TITLE}    = the target job role only — 1-3 words, drop qualifiers like "Aspiring" or "Junior"
{SKILL}    = a specific technology — 1-2 words
{TARGET_1} = the first verbatim resume fact, exactly as written
{TARGET_2} = the second verbatim resume fact, exactly as written

SLOT LENGTH RULES (hard limits — violating these breaks the template):
- {COURSE}: 3 words maximum. Shorten aggressively. "Advanced Data Structures & Algorithms" → "Data Structures". "Deep Learning fundamentals" → "Deep Learning". "Machine Learning with Python" → "Machine Learning".
- {TITLE}: 3 words maximum. Strip "Aspiring", "Junior", "Entry-Level". "Aspiring Software Developer" → "Software Developer". "Junior Frontend Engineer" → "Frontend Engineer". If {TITLE} is not in the facts, write "Software Developer role".
- {PROJECT}: exact project name only. "NoteSphere" — not "NoteSphere: a task management app".
- {SKILL}: 1-2 words. The technology name only.

RULES:
- Replace every {SLOT} in the template. No placeholder may remain in the output.
- Preserve all punctuation, capitalization, and tone from the template exactly.
- Output only the completed sentence. Nothing else.`,
            },
            {
              role: 'user',
              content: `Template to complete:\n\n${selectedTemplate}\n\nResume facts (verbatim):\n${targetList}\n\nFill every {SLOT} using the facts above. Return only the completed sentence.`,
            },
          ],
        }),
      }),
      2500,
      'Groq Roast'
    );

    if (!res.ok) {
      console.warn(`⚠️  Groq Roast returned ${res.status}`);
      return null;
    }
    const json = await res.json();
    const raw: string = (json?.choices?.[0]?.message?.content ?? '').trim();
    // Strip surrounding quotes the model sometimes adds
    const text = raw.replace(/^["'\`]|["'\`]$/g, '').trim();
    if (text.length < 10 || text.length > 350) return null;
    return text;
  } catch (e: any) {
    console.warn(`⚠️  Groq Roast failed: ${e?.message?.slice(0, 80) ?? e}`);
    return null;
  }
}



// ── Groq Roast Body: Stage 3 ─────────────────────────────────────────────────
// Rewrites roast_body at temp 0.7. Stage 1 at temp 0.3 defaults to safe
// career-advice prose and violates the hard-ban list (e.g. "impressive",
// "the candidate should"). Stage 3 fires in parallel with Stage 2 via
// Promise.allSettled — zero added latency.
async function callGroqRoastBody(targets: string[]): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || targets.length === 0) return null;

  const targetList = targets.map((t, i) => `${i + 1}. "${t}"`).join('\n');

  try {
    const res = await withTimeout(
      fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          temperature: 0.7,
          max_tokens: 220,
          messages: [
            {
              role: 'system',
              content: `You are a brutal FAANG recruiter who has reviewed 50,000 resumes. Write EXACTLY 3 sentences about this specific resume. No warmup. No intro. Start with sentence 1.

S1: The single most embarrassing gap, contradiction, or irony on this resume. Name the literal thing by its actual name from the resume. Cold. Flat. No compliments. No softening. Like a doctor stating a diagnosis.

S2: The exact mechanical reason this resume loses in screening versus a real competitor in the same pool. Name the specific thing on this resume that costs the interview. State it as a fact, not advice.

S3: One surgical fix tied to a specific named element on this resume. A verdict. Not a coaching tip. Not a suggestion.

BANNED WORDS — if any of these appear in a sentence, rewrite it from scratch:
impressive, solid, strong, great, potential, promising, game-changer, the candidate, they should, the applicant, demonstrates, would benefit, could improve, overall, well-rounded

GENERIC TEST: Remove all proper nouns from each sentence. If the sentence still reads as feedback on any resume, it is too generic. Rewrite it until it can only describe this specific resume.

Output: 3 sentences. Period after each. No labels. No preamble. Nothing else.`,
            },
            {
              role: 'user',
              content: `Resume facts (verbatim):\n${targetList}\n\nWrite the 3 sentences now.`,
            },
          ],
        }),
      }),
      2500,
      'Groq RoastBody'
    );

    if (!res.ok) { console.warn(`⚠️  Groq RoastBody returned ${res.status}`); return null; }
    const json = await res.json();
    const raw: string = (json?.choices?.[0]?.message?.content ?? '').trim();
    const text = raw.replace(/^["'`]|["'`]$/g, '').trim();
    if (text.length < 30 || text.length > 700) return null;
    return text;
  } catch (e: any) {
    console.warn(`⚠️  Roast Stage 3 failed: ${e?.message?.slice(0, 80) ?? e}`);
    return null;
  }
}

// ── POST Handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const start = Date.now();

  try {
    // ── 0. Server-side parse gate ─────────────────────────────────────────────
    // Require auth for all requests — anonymous callers could otherwise bypass
    // the client-side gate and burn Groq credits indefinitely.
    // New users get 3 free parses on signup; no anonymous parse needed.
    const { userId } = await auth();
    if (!userId) {
      const body: ErrorResponse = {
        ok: false, mode: 'error',
        error: 'Sign in to analyse your resume. New accounts get 3 free analyses.',
        code: 'RATE_LIMITED',
      };
      return NextResponse.json(body, { status: 401 });
    }

    // Check signed-in user parse limit
    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    if (dbUser) {
      const fullAccess = Boolean((dbUser as Record<string, unknown>).hasFullAccess);
      if (!fullAccess && dbUser.parseCount >= dbUser.parseLimit) {
        const body: ErrorResponse = {
          ok: false, mode: 'error',
          error: 'You have used all your free parses. Upgrade to unlock unlimited.',
          code: 'PARSE_LIMIT_EXCEEDED',
        };
        return NextResponse.json(body, { status: 403 });
      }
    }

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

    // Server-side file size guard (5 MB) — client validates too but API can be called directly
    const MAX_BYTES = 5 * 1024 * 1024;
    if (buffer.length > MAX_BYTES) {
      const body: ErrorResponse = {
        ok: false, mode: 'error',
        error: 'File exceeds 5 MB limit. Compress or re-export your PDF.',
        code: 'INVALID_PDF',
      };
      return NextResponse.json(body, { status: 413 });
    }

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

    let rawAIOutput: unknown;
    try {
      rawAIOutput = await callGroq(textForAI);
    } catch (e: any) {
      console.error(`❌ Groq failed: ${e?.message ?? e} [+${Date.now() - start}ms]`);
      const body: ErrorResponse = {
        ok: false, mode: 'error',
        error: 'AI analysis failed. Please try again.',
        code: 'AI_FAILED',
      };
      return NextResponse.json(body, { status: 500 });
    }

    const analysis = normalizeAnalysisResult(rawAIOutput, resumeText);

    // Stage 2: roast one-liner — tiny separate call so temp 0.9 can't corrupt the main JSON
    const rawTargets = (rawAIOutput as Record<string, unknown>)?.roast_targets;
    const roastTargets: string[] = Array.isArray(rawTargets)
      ? rawTargets.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
      : [];
    if (roastTargets.length > 0) {
      const { template: roastTemplate, category: roastCategory } = selectTemplate(roastTargets);
      // Run Stage 2 (headline) and Stage 3 (body) in parallel — no latency cost.
      const [headlineResult, bodyResult] = await Promise.allSettled([
        callGroqRoast(roastTargets, roastTemplate),
        callGroqRoastBody(roastTargets),
      ]);
      if (headlineResult.status === 'fulfilled' && headlineResult.value) {
        analysis.roast_headline = headlineResult.value;
        console.log(`🔥 Roast headline: "${headlineResult.value}"`);
      } else {
        console.warn('⚠️  Roast Stage 2 returned null — keeping Stage 1 headline');
      }
      if (bodyResult.status === 'fulfilled' && bodyResult.value) {
        analysis.roast_body = bodyResult.value;
        console.log('🔥 Roast body: Stage 3 complete');
      } else {
        console.warn('⚠️  Roast Stage 3 returned null — keeping Stage 1 body');
      }
    }

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
