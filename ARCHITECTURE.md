# CandidAI — Architecture Reference

---

## System Overview

```
User (browser)
    |
    | HTTPS
    v
Vercel Edge (Next.js 13.5.1 App Router)
    |
    |-- /app/page.tsx              Landing
    |-- /app/dashboard/page.tsx    Upload UI + parse gate
    |-- /app/results/page.tsx      Results display + Apply Engine
    |-- /app/cover-letter/page.tsx Stripe success -> show letter
    |-- /app/sign-in/...           Clerk hosted sign-in
    |-- /app/privacy/page.tsx      Legal
    |-- /app/terms/page.tsx        Legal
    |
    |-- /api/analyze               POST -- 3-stage Groq pipeline
    |-- /api/apply-preview         POST -- free 1-para cover letter
    |-- /api/apply-full            POST -- paid 3-para cover letter
    |-- /api/user/usage            GET  -- {parseCount, parseLimit, remaining}
    |-- /api/user/increment        POST -- +1 parse_count (auth required)
    |-- /api/analyses              POST -- save analysis result (auth required)
    |-- /api/stripe/create-checkout      POST -- cover letter Stripe session
    |-- /api/stripe/create-parse-checkout POST -- parse credits Stripe session
    |-- /api/stripe/verify-session GET  -- confirm payment
    |-- /api/stripe/webhook        POST -- Stripe events (payment complete)
    |-- /api/webhooks/clerk        POST -- Clerk events (signup, deletion)
    |
    +-- External Services
        |-- Groq API (llama-3.3-70b-versatile) -- LLM
        |-- Clerk -- Auth + Google OAuth
        |-- Neon Postgres -- Database
        |-- Stripe -- Payments
```

---

## User Flow

```
ANONYMOUS USER (parse 1)
========================
Visit / -> dashboard
Upload PDF -> POST /api/analyze
 -> localStorage: candidai_parse_count = 1
View results -> share / apply preview (free)
Unlock cover letter OR parse 2:
 -> modal: "Sign in with Google to continue"


REGISTERED USER (parses 2-5)
==============================
Sign in with Google (Clerk)
Upload PDF -> POST /api/analyze
 -> POST /api/user/increment (server)
 -> POST /api/analyses (save result)
View results
On parse 6: paywall modal shown


PAYING USER (parse credits)
============================
Paywall modal -> "Get 10 more parses for $4.99"
POST /api/stripe/create-parse-checkout
Redirect to Stripe
Payment complete -> /api/stripe/webhook
 -> users.parseLimit += 10
 -> purchases row created
User returns to dashboard -> 10 more parses


COVER LETTER PURCHASE
=====================
Results page -> "Unlock Full Cover Letter"
POST /api/stripe/create-checkout
 -> saves {analysis, jd} to localStorage before redirect
Redirect to Stripe
Payment complete -> /cover-letter?session_id=xxx
 -> GET /api/stripe/verify-session (confirm paid)
 -> POST /api/apply-full (generate letter)
 -> Display 3-para letter with copy button
```

---

## Database Schema

```
users
  id TEXT PK              = Clerk user_id (e.g. user_2abc...)
  email TEXT NOT NULL
  parseCount INT DEFAULT 0
  parseLimit INT DEFAULT 5
  createdAt TIMESTAMPTZ

analyses
  id UUID PK
  userId TEXT FK -> users.id ON DELETE CASCADE
  createdAt TIMESTAMPTZ
  detectedRole TEXT
  tier TEXT               S/A/B/C/D/F
  contentScore INT
  atsScore INT
  roastHeadline TEXT
  roastBody TEXT
  dimensionScores JSONB
  hiringPrediction JSONB
  redFlags JSONB
  strengths JSONB
  topPriority TEXT
  -- NO resumeText EVER

purchases
  id UUID PK
  userId TEXT FK -> users.id
  type TEXT               'parse_credits' | 'cover_letter'
  stripeSessionId TEXT UNIQUE
  creditsAdded INT DEFAULT 0
  amountCents INT
  createdAt TIMESTAMPTZ
```

---

## API Contracts

### POST /api/analyze
Request: multipart/form-data {resume: File, jobDescription?: string}
Response: {analysis: AnalysisResult, truncated: boolean}
Auth: none (parse 1 anonymous, others checked client-side before call)
Side effects: none (no DB write here, dashboard handles it)

### GET /api/user/usage
Request: none (Clerk session from middleware)
Response: {parseCount: number, parseLimit: number, remaining: number}
Auth: Clerk required

### POST /api/user/increment
Request: {} (empty)
Response: {parseCount: number}
Auth: Clerk required
Side effects: users.parseCount++

### POST /api/analyses
Request: {analysis: AnalysisResult}
Response: {id: string}
Auth: Clerk required
Side effects: INSERT analyses row

### POST /api/stripe/create-checkout
Request: {jobDescription: string}
Response: {url: string} (Stripe checkout URL)
Auth: Clerk recommended, not required
success_url: /cover-letter?session_id={CHECKOUT_SESSION_ID}

### POST /api/stripe/create-parse-checkout
Request: {}
Response: {url: string}
Auth: Clerk required
success_url: /dashboard?credits=added
metadata: {type: 'parse_credits', userId: clerk_user_id}

### POST /api/stripe/webhook
Handles: checkout.session.completed
- metadata.type = 'parse_credits' -> users.parseLimit += PARSE_CREDIT_PACK_COUNT + INSERT purchases
- metadata.type = 'cover_letter' -> INSERT purchases only
Stripe-Signature header verified with STRIPE_WEBHOOK_SECRET

### POST /api/webhooks/clerk
Handles:
- user.created -> INSERT users(id=clerk_id, email)
- user.deleted -> DELETE FROM users WHERE id=clerk_id (CASCADE kills analyses)
svix-signature header verified with CLERK_WEBHOOK_SECRET

---

## Environment Variables (full set)

```
# Groq (existing, working)
GROQ_API_KEY=gsk_...

# Clerk (to add)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SECRET=whsec_...

# Neon Postgres (to add)
DATABASE_URL=postgresql://...

# Stripe (replace placeholders)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Pricing config
COVER_LETTER_PRICE_CENTS=499
PARSE_CREDIT_PACK_PRICE_CENTS=499
PARSE_CREDIT_PACK_COUNT=10

# App
NEXT_PUBLIC_BASE_URL=http://localhost:3000   # -> https://candidai.app on prod
```

---

## Security Decisions

| Concern | Decision |
|---------|----------|
| Resume PII | Never stored. Sent to Groq (data processor) and discarded. |
| Auth | Clerk handles OAuth, tokens, sessions. No passwords stored by us. |
| Payment data | Stripe handles. We store only session_id and amount. |
| User deletion | Clerk webhook -> DELETE user row -> CASCADE deletes analyses. |
| DPDP Act (India) | Covered by: no data storage of PII, deletion rights, Groq disclosed as processor. |
| Rate limiting | Parse gate (5 free, pay for more) is primary protection. IP rate limit: future concern. |
| Stripe webhooks | STRIPE_WEBHOOK_SECRET validates all webhook payloads. |
| Clerk webhooks | svix-signature validates all Clerk webhook payloads. |

---

## Monetization Model

| Action | Price | Notes |
|--------|-------|-------|
| Parse 1 | Free | Anonymous, no account needed |
| Parse 2-5 | Free | Requires Google login |
| Parse 6+ | $4.99 / 10 parses | Credit pack via Stripe |
| Cover Letter (full) | $4.99 per letter | Separate Stripe checkout |

Groq cost per user for 5 free parses: ~$0.025-0.030 (negligible)

---

*ARCHITECTURE.md -- CandidAI -- 2026-06-23*
