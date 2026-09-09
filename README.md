# CandidAI

Brutally honest AI resume analysis. Upload a PDF, get a role-aware score, a tier
grade, a list of the things that will actually get you rejected, and a cover
letter tailored to a specific job description.

> **Note on this repository's visibility.** This is the source of a paid
> product. It currently has no licence, which under default copyright means all
> rights reserved. Decide deliberately whether it should stay public — see
> "Repository visibility" below.

## Stack

| Layer     | Choice                                                  |
| --------- | ------------------------------------------------------- |
| Framework | Next.js 13.5.11 (App Router)                            |
| Auth      | Clerk (`@clerk/nextjs` v6, `clerkMiddleware`)           |
| Database  | PostgreSQL via Prisma                                    |
| AI        | Groq — `openai/gpt-oss-120b`, see `lib/constants.ts`     |
| Payments  | Whop (one-time $4.99 full access)                        |
| Hosting   | Vercel                                                   |
| PDF text  | `pdfjs-dist` → `pdf-parse` → raw BT/ET regex scrape      |

## Running locally

```bash
npm install
npx prisma generate
npm run dev
```

No `.npmrc` overrides are needed — `npm ci` resolves peers cleanly. If you ever
find yourself reaching for `legacy-peer-deps` here, treat it as a signal that
Clerk and Next have drifted out of their supported pairing again, and fix the
versions instead of silencing the check. See "Version pairing" below.

### Environment variables

| Variable                            | Purpose                                          |
| ----------------------------------- | ------------------------------------------------ |
| `DATABASE_URL`                      | Postgres connection string                       |
| `GROQ_API_KEY`                      | Groq inference                                   |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk client                                     |
| `CLERK_SECRET_KEY`                  | Clerk server                                     |
| `CLERK_WEBHOOK_SECRET`              | Verifies `user.created` / `user.deleted` (svix)  |
| `WHOP_WEBHOOK_SECRET`               | HMAC secret for purchase webhooks                |
| `NEXT_PUBLIC_WHOP_CHECKOUT_URL`     | Checkout link. **Unset = both buy buttons fail.** |
| `NEXT_PUBLIC_SITE_URL`              | Canonical origin for OG/canonical tags           |

## How the paywall works

Three independent gates, in order of authority:

1. **Parse credits.** `/api/analyze` reserves a credit with one conditional
   `UPDATE ... WHERE parseCount < parseLimit`, so the check and the decrement
   cannot be separated by a race. A request that fails for a reason outside the
   user's control gets the credit refunded in a `finally` block. New accounts
   get `FREE_PARSE_LIMIT` (`lib/constants.ts`, kept in sync with the schema
   default).
2. **Full access.** `hasFullAccess` on `User`, set by the Whop webhook, or by
   `/api/whop/claim` when the buyer's email differed from their account email.
   A claim only succeeds for an address **verified on the caller's own Clerk
   profile**.
3. **Rate limits.** `lib/rate-limit.ts` — in-process, per instance. A backstop
   against scripted loops, not a global guarantee. Swap in Redis behind the same
   `rateLimit(key, limit, windowMs)` signature when traffic justifies it.

Nothing about the paywall is enforced in the browser. The client mirrors state
for UI purposes only.

## Data handling

Resume text is never stored. `Analysis` rows hold scores, roast text and
metadata only — see the comment on the model in `prisma/schema.prisma`.
`GET /api/analyses` returns the caller's own history; `DELETE /api/user/data`
erases it immediately. Both are reachable from the dashboard, which is what the
privacy policy promises.

## Schema changes

There is no `prisma/migrations` directory — the schema is applied with
`prisma db push`. After changing `schema.prisma`:

```bash
npx prisma db push
npx prisma generate
```

## Version pairing

**Clerk and Next must stay inside Clerk's declared peer range.** This is not
advisory. The app previously ran `@clerk/nextjs@7.5.7` (peer: Next 15.2.8+ / 16)
against Next 13.5.1. It compiled, it passed typecheck, and it worked in local
dev and in `next start` — then crashed in Vercel's Edge runtime with:

```
[TypeError: Super constructor null of yo is not a constructor]
```

Clerk 7's middleware bundle extends a class that only exists in the Next 15+
edge runtime. Next's local edge sandbox is permissive enough to paper over it;
Vercel's real V8 isolate is not. A green build proves nothing about this class
of failure.

Current pairing: **Next 13.5.11 + @clerk/nextjs 6.33.3** (peer: `^13.5.7`).

Before changing either version, check the range first:

```bash
npm view @clerk/nextjs@<version> peerDependencies.next
```

Clerk 6 warns that Next 13 support ends in its next major. The eventual move is
Next 14.2.25+ (still Clerk 6) or Next 15 + React 19 (Clerk 7). Either needs its
own pass with sign-in, checkout and the webhook exercised against real
credentials **on a deployed preview**, not just locally.

`pdfjs-dist` is pinned at 3.11.174, which is affected by GHSA-wgrm-67xf-hhpq
(script execution from a crafted PDF). The documented mitigation,
`isEvalSupported: false`, is applied at every `getDocument` call site. Upgrading
past 4.x means moving from `require()` to the ESM `pdf.mjs` build, so it needs
the multipage extraction path re-tested with real resumes.

## Repository visibility

This repo is public and unlicensed. If CandidAI stays commercial, make it
private — the paywall logic and prompt library are the product. If the open
source is part of the pitch, add a licence file so the terms are explicit.
