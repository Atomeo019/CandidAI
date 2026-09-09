# CandidAI — CTO Audit & Fix Report
Repo: `C:\internshiper\skeleton\project` · Branch: `fix/launch-blockers` (uncommitted) · Audited: 2026-09-08

Read this before you paste it into Claude Code. This is a second-pass audit on top of the
existing uncommitted diff (the one already fixed 18 issues). Everything below is either
something that diff missed, or a fresh problem it doesn't touch. I read every API route,
the schema, the webhook logic, and the auth middleware directly off disk — this isn't
guesswork from docs.

Two things I want to tell you straight before the list: the `postinstall: "prisma generate"`
script you were worried about in July **is already in package.json** — that fear is dead,
don't waste time on it. And `WHOP_WEBHOOK_SECRET` is **still blank** in `.env.local`, exactly
like the last report said — this is not new, but it is still the single biggest reason real
money might be walking in the door and nothing happening.

---

## SEVERITY 1 — Money-loss / will bite you after launch, not before

### 1.1 A refund or chargeback never revokes access
**File:** `app/api/whop/webhook/route.ts`
**What's there:** the handler only listens for `action === 'membership.went_valid'`. There is
no case for a membership going invalid — cancellation, refund, or a disputed charge.
**Why it's real money loss:** the moment `hasFullAccess` is set to `true`, nothing in this
codebase can ever set it back to `false`. A customer who buys, uses it, then disputes the
$4.99 charge (or Whop refunds them for any reason) keeps unlimited access forever. At $4.99 a
head this is a slow bleed, not a catastrophe — but it's a bleed with no cap, and it compounds
every month you don't fix it.
**Fix instruction for Claude Code:** add a handler for Whop's invalidation event (confirm the
exact event name in Whop's current webhook docs — it has historically been
`membership.went_invalid`, but verify before coding against it) that sets
`hasFullAccess: false` for the matching user, looked up the same way `went_valid` does
(by membership/`lsOrderId`, not by email — email can change). Log it the same way the grant
is logged, so a refund shows up in the logs as clearly as a sale does.

---

## SEVERITY 2 — Silent lost sales / support burden (not a hack, but it will cost you customers and your own time)

### 2.1 Email casing mismatch can silently break the auto-grant-on-purchase path
**Files:**
- `app/api/webhooks/clerk/route.ts:37` — stores `email_addresses[0].email_address` as-is
- `app/api/analyze/route.ts:632` — same, stores `clerkUser.emailAddresses[0].emailAddress` as-is
- `app/api/user/usage/route.ts:18` — same
- `app/api/whop/webhook/route.ts` — matches with `email.toLowerCase().trim()` against
  `prisma.user.findFirst({ where: { email } })`

**What's wrong:** three separate places write `User.email` to the database using whatever
casing Clerk hands back (which depends on the OAuth provider and isn't guaranteed lowercase).
The Whop webhook's own match is correctly lowercased on its side, but Postgres string
equality is case-sensitive by default — so if a customer's stored email has even one
uppercase character that differs from what Whop sends, `findFirst` matches **zero rows**,
and the webhook silently falls into the "no matching user" branch: it stores the purchase as
pending instead of granting access immediately. The customer paid, got no unlock, and lands
on a support email or the confirming-purchase screen timing out into a claim form instead of
instant access. The self-serve claim flow (`whop/claim`) still works for them because *it*
lowercases both sides — so nobody is permanently locked out, but you will get "I paid and
nothing happened" messages that are actually just a casing bug.
**Fix instruction for Claude Code:** lowercase `email` at all three write sites before it
hits Prisma, and change the Whop webhook's lookup to a case-insensitive match
(`findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })`) as defense in
depth. Also write a one-time migration script to lowercase any existing rows in the `User`
table so this doesn't just fix new signups.

### 2.2 `User.email` has no unique constraint, and the Whop webhook uses `findFirst`
**File:** `prisma/schema.prisma` — `email String` (no `@unique`)
**What's wrong:** nothing in the schema stops two `User` rows from holding the same email.
`findFirst` with no `orderBy` returns whichever row Postgres feels like on a tie, which means
if a duplicate ever exists (stale row, manual fix gone wrong, a future auth-provider change),
a Whop purchase could get attached to the wrong account. Low probability today because Clerk
itself tends to enforce unique verified emails, but this is a load-bearing assumption you
haven't encoded anywhere in your own schema.
**Fix instruction for Claude Code:** decide whether to add `@unique` to `email` (needs a
migration, and you'd need to check current data for existing duplicates first — a duplicate
would fail the migration). If you don't want to force uniqueness yet, at minimum have the
Whop webhook log a warning and pick deterministically (e.g. earliest `createdAt`) rather than
relying on undefined `findFirst` ordering.

### 2.3 Clerk webhook never handles `user.updated`
**File:** `app/api/webhooks/clerk/route.ts`
**What's wrong:** only `user.created` and `user.deleted` are handled. If a signed-up user
later changes their primary email in Clerk, the `User.email` column goes stale forever — it's
never refreshed. Combined with 2.1, this means a customer who changes their email and then
buys with the new one will *never* auto-match, every time, not just on a casing fluke.
**Fix instruction for Claude Code:** add a `user.updated` case that updates `email` on the
matching `User` row (lowercased, per 2.1's fix).

### 2.4 `/api/apply-preview` doesn't actually meter usage — it's a free, roughly-unlimited Groq tap
**File:** `app/api/apply-preview/route.ts`
**What's wrong:** the entitlement check is `fullAccess || parseCount < parseLimit` — i.e.
"has at least one analysis credit left, of any kind." It never *consumes* a credit or a
separate counter. A free user who does exactly 2 of their 3 analyses (deliberately leaving
one unused forever) can call this route indefinitely, capped only by the 6-requests-per-minute
rate limit — that's up to 8,640 Groq-billed calls a day, forever, for a user who never pays
you a cent and never even needs a 4th analysis. This isn't a security hole, it's a cost-control
hole: the gate reads like a quota but doesn't behave like one.
**Fix instruction for Claude Code:** decide the actual product intent, then implement it
explicitly — either (a) give apply-preview its own small daily/lifetime cap independent of
`parseCount`, or (b) have it consume a real credit like `/api/analyze` does, or (c) if
unlimited-while-any-credit-remains is genuinely the intended design, at minimum add a hard
daily ceiling per user so a single account can't be scripted into thousands of calls a day.

---

## SEVERITY 3 — Hardening (not blocking today's ship, but you're a login-gated app handling personal documents and should not skip these for long)

### 3.1 No security headers anywhere
**File:** `next.config.js` (no `headers()` function at all)
**What's missing:** no `X-Frame-Options`/`frame-ancestors`, no
`Content-Security-Policy`, no `X-Content-Type-Options`, no `Strict-Transport-Security`,
no `Referrer-Policy`. Right now your login page, checkout redirect, and claim-purchase form
could all be framed inside an invisible iframe on another site (clickjacking) with nothing
stopping it.
**Fix instruction for Claude Code:** add a `headers()` export in `next.config.js` applying at
minimum `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and
`Referrer-Policy: strict-origin-when-cross-origin` to all routes. A full CSP is a bigger job
(Clerk, Groq, Google Fonts, and any inline scripts all need allowlisting) — don't attempt a
strict CSP under today's deadline pressure, but the three headers above are cheap and safe to
add right now.

### 3.2 Uploaded filenames are written to server logs
**File:** `app/api/analyze/route.ts` — `console.log(\`📥 Received file: "${file.name}" — ...\`)`
**What's wrong:** your privacy policy promises you never store resume text. The filename
itself isn't resume text, but people frequently name resumes things like
`Aravind_Praveen_Resume_2026.pdf` — that's a real name landing in Vercel's log retention,
which is a third-party system outside your stated data-handling promise, however minor.
**Fix instruction for Claude Code:** drop `file.name` from the log line, or log only its
length/extension.

### 3.3 Two env vars are configured but never referenced in code
**Vars:** `GEMINI_API_KEY`, `ANTHROPIC_API_KEY` (set in `.env.local`; `grep -r` across
`app/` and `lib/` finds zero usages of either)
**Why it's worth a line:** not a vulnerability, just dead configuration. Your own project
notes mention a planned "Gemini roast" path that isn't in the code that's actually on disk —
either that got descoped and the key should go, or it's still coming and this is a reminder
it isn't wired up yet. Not for Claude Code to guess at — just confirm your own intent.

---

## Confirmed clean — don't let anyone talk you into "fixing" these

- `postinstall: "prisma generate"` **is** in `package.json`. The July concern is resolved.
- `.env` / `.env.local` has never been committed to git, ever, in this repo's history —
  verified against full git log, not just current `.gitignore`.
- Every API route that touches money or personal data (`analyze`, `apply-preview`,
  `apply-full`, `whop/claim`, `analyses`, `user/data`, `user/usage`) independently checks
  `auth()` and returns 401 — the Clerk middleware doesn't auto-protect routes on its own
  (it just attaches `auth()`), but every handler does its own check correctly, so this isn't
  the gap it could have been.
- The parse-credit reservation in `/api/analyze` is a genuine atomic `UPDATE ... WHERE`
  (raw SQL), not a check-then-write — no race condition there. The refund-on-failure logic
  in the `finally` block is correct and uses `GREATEST(parseCount - 1, 0)` so it can't go
  negative.
- The Whop webhook's signature verification uses `crypto.timingSafeEqual` correctly
  (length-checked before comparing, so it can't throw), handles both signature formats
  Whop is known to use, and rejects anything older than 5 minutes as a replay. This part is
  solid.
- The claim-purchase flow (`whop/claim`) requires the claimed email be one of the caller's
  own **verified** Clerk emails, uses `updateMany` with `userId: null` still in the `WHERE`
  so two concurrent claims can't double-claim one purchase, and is rate-limited. No notes.
- No `dangerouslySetInnerHTML`, `eval`, or raw `innerHTML` usage anywhere in `app/` or
  `components/` (one instance in a vendored shadcn chart component injecting CSS variables —
  not attacker-reachable).
- No leftover client-side credit tracking or calls to the deleted `/api/user/increment` —
  fully removed, matches the earlier fix report.

---

## What I did NOT re-verify (be aware, don't assume)
I read the code as it sits on disk. I did not run the app, did not hit a real Groq/Whop/Clerk
endpoint, and did not run `npm run build` or `tsc` myself in this pass — the prior session's
report already confirmed those pass on this exact diff, and nothing in my read of the code
suggests that's stale. If you want that re-confirmed, that's a 2-minute local `npm run build`
before you commit, not something worth spending Claude Code's time on.

## Suggested order for Claude Code
1. Severity 1 (1.1) — one clear fix, real money exposure, do it first.
2. Severity 2 items together (2.1–2.4) — they're all in the same two files
   (`webhooks/clerk`, `whop/webhook`) plus one schema decision, efficient to batch.
3. Severity 3 (3.1, 3.2) — quick, low-risk, do them same session.
4. 3.3 is a five-minute conversation with yourself, not a code change — decide, then either
   delete the keys or open a ticket to wire up Gemini.

None of this blocks today's deploy on its own — `WHOP_WEBHOOK_SECRET` being empty (from the
last report) is still the only thing that will make today's launch look broken from the
outside. But 1.1 and 2.1 are the two I'd want fixed before you drive real traffic at this,
not after.
