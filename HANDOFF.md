# CandidAI — Full Memory Context Handoff
**Last updated: 2026-06-23 | Overwrite of previous ResumeRoast handoff**

---

## PASTE THIS AT THE TOP OF YOUR NEW CHAT

> **Project: CandidAI** (formerly ResumeRoast — rename pending in code). Resume analysis + roast web app. Next.js 13.5.1 App Router, TypeScript, Groq API (llama-3.3-70b-versatile), Stripe. Local folder: `C:\\internshiper\\skeleton\\project`.
>
> **Current state:** Core pipeline works (3-stage Groq: analysis -> template headline -> roast body). 40 roast templates across 4 categories. Apply Engine (cover letter preview free, full letter paid $4.99). No auth, no database, no real Stripe keys yet.
>
> **What we're building next:** Clerk (Google OAuth) + Neon Postgres + Prisma + 5-free-parse gate + Stripe paywall for parse 6+ + cover letter payment wiring + legal pages + full CandidAI rebrand.
>
> **Critical rule:** NEVER use the Edit/Write tools directly on .ts or .tsx files -- em-dashes and Unicode corrupt. Always patch via Python heredoc in bash. After every patch: `timeout 45 npx tsc --noEmit --skipLibCheck`.
>
> **Read HANDOFF.md first** -- it has the full architecture, all bugs, all pending phases, and every decision made.

---

## 1. WHAT THIS PROJECT IS

CandidAI is a Next.js resume analysis tool for IT/SWE candidates. Users upload a PDF resume and receive:
- A Tier rating (S through F)
- A roast headline (punchy one-liner via template library + Groq slot-fill)
- A roast body (3 brutal sentences naming literal resume facts)
- ATS breakdown, dimension scores, red flags, action plan
- Apply Engine: free 1-paragraph cover letter preview + paid 3-paragraph full letter ($4.99 Stripe)

**Stack:** Next.js 13.5.1 App Router, TypeScript, Groq API, Stripe, Vercel  
**Local path:** `C:\\internshiper\\skeleton\\project`  
**Bash sandbox:** `/sessions/dazzling-pensive-brown/mnt/project/`

---

## 2. CRITICAL RULES

### NEVER use Edit/Write tools on .ts or .tsx files
Em-dashes, smart quotes, Unicode get corrupted. Always patch via Python heredoc in bash:

```bash
cat << 'INNEREOF' > /tmp/patch.py
import re
with open('/sessions/dazzling-pensive-brown/mnt/project/app/whatever.tsx', 'r', encoding='utf-8') as f:
    src = f.read()
src = src.replace('OLD', 'NEW')
with open('/sessions/dazzling-pensive-brown/mnt/project/app/whatever.tsx', 'w', encoding='utf-8') as f:
    f.write(src)
print('done')
INNEREOF
python3 /tmp/patch.py
```

### Always verify TSC after any patch:
```
cd /sessions/dazzling-pensive-brown/mnt/project && timeout 45 npx tsc --noEmit --skipLibCheck 2>&1 | head -30
```
Zero output = zero errors.

### Python Unicode in heredocs: use `"\U0001F480"` not `\u{1F480}`

---

## 3. CURRENT CODEBASE STATE

| File | Lines | Status |
|------|-------|--------|
| app/api/analyze/route.ts | 713 | WORKING -- main pipeline, 3-stage, 40 templates |
| app/results/page.tsx | 933 | NEEDS WORK -- ResumeRoast brand, disabled button, wrong domain |
| app/dashboard/page.tsx | ~250 | NEEDS WORK -- ResumeRoast brand |
| app/layout.tsx | 39 | NEEDS WORK -- ResumeRoast in all metadata |
| app/page.tsx | 176 | NEEDS WORK -- ResumeRoast brand |
| app/auth/page.tsx | ~130 | DELETE -- fake auth, handleSubmit just does router.push('/dashboard') |
| app/api/apply-full/route.ts | 268 | WORKS -- 3-para cover letter, not wired to UI |
| app/api/apply-preview/route.ts | 202 | WORKS -- 1-para preview, wired and working |
| app/api/stripe/create-checkout/route.ts | ~100 | WORKS -- Stripe session, but keys are placeholder |
| app/api/stripe/verify-session/route.ts | exists | WORKS -- session verification |
| lib/normalize.ts | 541 | WORKS -- score normalization, anti-inflation caps |
| lib/normalize_clean.ts | exists | DELETE -- dead duplicate, zero references |

### .env.local current state:
```
GROQ_API_KEY=gsk_REDACTED  <- set in .env.local and Vercel env vars
STRIPE_SECRET_KEY=sk_test_...           <- PLACEHOLDER, needs real key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...  <- PLACEHOLDER
COVER_LETTER_PRICE_CENTS=499
NEXT_PUBLIC_BASE_URL=http://localhost:3000
ANTHROPIC_API_KEY=                      <- empty, not used
GEMINI_API_KEY=...                      <- not used
```

---

## 4. PIPELINE ARCHITECTURE (CURRENT, WORKING)

```
PDF upload -> app/dashboard/page.tsx
  -> POST /api/analyze
     Stage 1: callGroq() llama-3.3-70b-versatile, temp 0.3, json_object, max_tokens 2800
       -> full AnalysisResult JSON including roast_targets[]
     normalizeAnalysisResult() -- score caps, tier derivation
     Promise.allSettled([Stage 2, Stage 3])  <- PARALLEL, no latency
       Stage 2: callGroqRoast() -- selectTemplate(targets) + slot-fill, temp 0.3, max_tokens 100
         -> overwrites analysis.roast_headline
       Stage 3: callGroqRoastBody() -- free-form body, temp 0.7, max_tokens 220
         -> overwrites analysis.roast_body
  -> sessionStorage (client-side, no DB yet)
  -> app/results/page.tsx displays everything
```

### Template Library (route.ts lines 273-363): 4 categories x 10 = 40 templates

selectTemplate() detection logic:
- CL_TEMPLATES: targets contains "currently learning:"
- AT_TEMPLATES: targets contains "aspiring" or "enthusiast"
- NM_TEMPLATES: targets contains "no metric", "zero user", "no documented", "not stated"
- CA_TEMPLATES: catch-all

Stage 2 slots: {PROJECT}, {COURSE}, {TITLE} (fallback: "this role" <- BUG), {TARGET_1}, {TARGET_2}

---

## 5. KNOWN BUGS

| # | Bug | Fix |
|---|-----|-----|
| 1 | "on a this role application" -- {TITLE} fallback breaks grammar | Change fallback from "this role" to "Software Developer role" in Stage 2 system prompt |
| 2 | app/auth/page.tsx is fake auth | DELETE the file entirely, replace with Clerk |
| 3 | Unlock Full Cover Letter is disabled / "Coming Soon" | Remove disabled attr in results/page.tsx line ~680, wire to /api/stripe/create-checkout |
| 4 | /cover-letter page doesn't exist (Stripe success_url 404s) | Create app/cover-letter/page.tsx |
| 5 | Stripe keys are placeholders | Add real keys to .env.local |
| 6 | 16 occurrences of "ResumeRoast" across 9 files | Batch Python replace (see Section 6) |
| 7 | Share card hardcodes resumeroast.app (results/page.tsx line 902) | Replace with candidai.app |
| 8 | lib/normalize_clean.ts is dead duplicate | Delete file |
| 9 | roast_body S3 sentence reads as career advice | Harden S3 instruction to verdict framing |

---

## 6. BRAND RENAME (ResumeRoast -> CandidAI)

16 occurrences in 9 files:

| File | Occurrences |
|------|-------------|
| app/layout.tsx | 5 (title, description, OG title, siteName, Twitter title) |
| app/page.tsx | 2 (nav span, footer copyright) |
| app/auth/page.tsx | 1 -- but DELETE this whole file anyway |
| app/dashboard/page.tsx | 2 nav spans |
| app/results/page.tsx | nav span (line 270), share card span (line 864), domain (line 902) |
| app/api/apply-full/route.ts | system prompt example (line 103) |
| app/api/apply-preview/route.ts | system prompt example (line 76) |
| app/api/analyze/route.ts | system prompt example (line 110) |

Use Python batch replace -- never Edit/Write tool on .ts/.tsx files.

---

## 7. PRODUCT DECISIONS (locked)

1. 5 free parses total (including anonymous first one), then Stripe paywall
2. Parse 1: Anonymous, no login. localStorage flag set after.
3. Parses 2-5: Google login required (Clerk). Free.
4. Parse 6+: Stripe credit pack (e.g. 10 parses for $4.99)
5. Cover letter: Always requires login + $4.99 Stripe per letter (separate flow)
6. NEVER store resume text. Only store analysis results/metrics.
7. Auth: Clerk + Google OAuth only (no email/password)
8. DB: Neon Postgres + Prisma (serverless, Vercel-native)
9. Legal: Privacy policy + Terms required before launch

---

## 8. DATABASE SCHEMA (to create)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id          String     @id                    // = Clerk user_id
  email       String
  parseCount  Int        @default(0)
  parseLimit  Int        @default(5)
  createdAt   DateTime   @default(now())
  analyses    Analysis[]
  purchases   Purchase[]
}

model Analysis {
  id               String   @id @default(uuid())
  userId           String
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt        DateTime @default(now())
  detectedRole     String?
  tier             String?
  contentScore     Int?
  atsScore         Int?
  roastHeadline    String?
  roastBody        String?
  dimensionScores  Json?
  hiringPrediction Json?
  redFlags         Json?
  strengths        Json?
  topPriority      String?
  // NO resumeText field -- ever
}

model Purchase {
  id              String   @id @default(uuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  type            String   // 'parse_credits' | 'cover_letter'
  stripeSessionId String   @unique
  creditsAdded    Int      @default(0)
  amountCents     Int
  createdAt       DateTime @default(now())
}
```

---

## 9. NEW FILES TO CREATE

```
middleware.ts
app/
  sign-in/[[...sign-in]]/page.tsx
  cover-letter/page.tsx
  privacy/page.tsx
  terms/page.tsx
  api/
    webhooks/clerk/route.ts
    user/
      usage/route.ts
      increment/route.ts
    stripe/
      create-parse-checkout/route.ts
      webhook/route.ts
prisma/
  schema.prisma
lib/
  db.ts
```

### New env vars to add:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SECRET=whsec_...
DATABASE_URL=postgresql://...
STRIPE_WEBHOOK_SECRET=whsec_...
PARSE_CREDIT_PACK_PRICE_CENTS=499
PARSE_CREDIT_PACK_COUNT=10
```

---

## 10. PARSE GATE LOGIC (dashboard/page.tsx)

```
On page load:
  localCount = parseInt(localStorage.getItem('candidai_parse_count') ?? '0')
  if localCount >= 1 AND !isSignedIn -> show "Sign in with Google to continue" modal
  if isSignedIn -> GET /api/user/usage -> check server count

Before upload:
  if !isSignedIn && localCount >= 1 -> block, show sign-in
  if isSignedIn && remaining <= 0 -> block, show Stripe paywall

After analysis completes:
  localStorage.setItem('candidai_parse_count', (localCount + 1).toString())
  if isSignedIn:
    POST /api/user/increment
    POST /api/analyses (save result to DB)
```

---

## 11. IMPLEMENTATION PHASES

### Phase 0 -- Cleanup (0.5 days) -- NO DEPENDENCIES, DO FIRST
- [ ] Delete app/auth/page.tsx (fake auth)
- [ ] Delete lib/normalize_clean.ts (dead file)
- [ ] Rebrand: 16 ResumeRoast -> CandidAI (Python batch replace all 9 files)
- [ ] Fix share card domain line 902: resumeroast.app -> candidai.app
- [ ] Fix grammar bug: Stage 2 {TITLE} fallback "this role" -> "Software Developer role"
- [ ] TSC verify

### Phase 1 -- Clerk Auth (1 day)
- [ ] npm install @clerk/nextjs
- [ ] Add CLERK keys to .env.local
- [ ] Create middleware.ts (Clerk auth middleware)
- [ ] Wrap app/layout.tsx in <ClerkProvider>
- [ ] Create app/sign-in/[[...sign-in]]/page.tsx with Clerk <SignIn />
- [ ] Add <SignInButton> / <UserButton> to nav
- [ ] Create app/api/webhooks/clerk/route.ts
  - user.created -> INSERT users row
  - user.deleted -> DELETE user (CASCADE handles analyses)
- [ ] Enable Google OAuth in Clerk dashboard
- [ ] Test: sign in with Google -> user appears in DB

### Phase 2 -- Database (1 day)
- [ ] npm install @prisma/client prisma
- [ ] Create Neon project (neon.tech), get DATABASE_URL
- [ ] Create prisma/schema.prisma (schema from Section 8)
- [ ] npx prisma db push
- [ ] Create lib/db.ts (Prisma singleton)
- [ ] Create GET /api/user/usage
- [ ] Create POST /api/user/increment
- [ ] Wire dashboard: after analysis -> POST increment + save if signed in
- [ ] Wire dashboard: localStorage count gate logic

### Phase 3 -- Parse Paywall (1 day)
- [ ] Create POST /api/stripe/create-parse-checkout
- [ ] Create POST /api/stripe/webhook
  - Verify Stripe signature
  - checkout.session.completed:
    - type=parse_credits -> increment user.parseLimit
    - type=cover_letter -> no DB action needed
  - Save to purchases table
- [ ] Register webhook in Stripe dashboard -> /api/stripe/webhook
- [ ] Build paywall UI component in dashboard
- [ ] Test: 5 free -> paywall -> pay -> 10 more

### Phase 4 -- Cover Letter Wiring (0.5 days)
- [ ] results/page.tsx line ~680: remove disabled + "Coming Soon"
- [ ] Wire button -> POST /api/stripe/create-checkout with real Stripe keys
- [ ] Create app/cover-letter/page.tsx:
  - Read session_id from URL params
  - GET /api/stripe/verify-session?session_id=X
  - Read jd + analysis from localStorage (set before Stripe redirect)
  - POST /api/apply-full
  - Show letter with copy button
- [ ] Add real Stripe keys to .env.local (dashboard.stripe.com/test/apikeys)

### Phase 5 -- Legal Pages (0.5 days)
- [ ] Create app/privacy/page.tsx
  - Collect: email (Google OAuth), analysis scores/results
  - Do NOT collect: resume text, files
  - Processors: Groq AI (resume sent, not stored), Clerk, Stripe, Neon
  - Deletion: account deletion cascades to all analysis data
- [ ] Create app/terms/page.tsx
  - Informational only, not career advice
  - No refunds on digital goods
- [ ] Add upload disclosure: "Analyzed in real-time. Resume not stored. Sent to Groq AI for processing."
- [ ] Add Privacy + Terms links to footer

### Phase 6 -- Deploy
- [ ] Set all env vars in Vercel dashboard
- [ ] npx prisma db push (production Neon URL)
- [ ] Register Stripe webhook for production URL
- [ ] Register Clerk webhook for production URL
- [ ] Full end-to-end test: anon -> login -> 5 parses -> paywall -> pay -> cover letter
- [ ] Flip Stripe from test -> live keys when ready

---

## 12. GROQ COST CONTEXT

Per analysis: ~3 API calls, ~5-6K tokens total = $0.004-0.006  
5 free parses per user = $0.025-0.030 Groq cost per user  
Negligible at small scale. Rate limit by IP as abuse protection (Phase 3+ concern).

---

## 13. QUICK COMMAND REFERENCE

```bash
# TSC check
cd /sessions/dazzling-pensive-brown/mnt/project && timeout 45 npx tsc --noEmit --skipLibCheck 2>&1 | head -30

# Find remaining ResumeRoast occurrences
grep -rn "ResumeRoast\|resumeroast" /sessions/dazzling-pensive-brown/mnt/project/app /sessions/dazzling-pensive-brown/mnt/project/lib --include="*.ts" --include="*.tsx"

# Prisma
npx prisma db push
npx prisma studio
npx prisma generate

# Install
npm install @clerk/nextjs @prisma/client prisma
```

---

*HANDOFF.md -- CandidAI -- 2026-06-23*
