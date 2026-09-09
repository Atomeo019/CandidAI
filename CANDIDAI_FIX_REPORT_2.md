# CandidAI — Round 2 Fix Report
Repo: `C:\internshiper\skeleton\project` · Branch: `fix/launch-blockers` (still uncommitted) · 2026-09-09

Covers the webhook correction plus items 1.1, 2.1–2.4, 3.1 and 3.2 from `CANDIDAI_FIX_REPORT.md`.
The Next 13→15 / Clerk peer-version upgrade (S2) was not touched and did not leak into
anything here.

Read the **Verified vs assumed** section before you deploy. One thing is deliberately left
unfinished, and it needs one real purchase from you to close.

---

## Your correction was right, and I confirmed it independently

Before writing any logic I checked Whop's published payload rather than take the correction
on trust. Both hold up:

- The event discriminator is **`type`**, not `action`. The envelope is
  `{ id, api_version, api_version_date, type, timestamp, account_id, data }`.
- The documented `payment.succeeded` example carries **`data.id` = `"pay_..."`** and
  **`data.member.id` = `"mem_..."`** — and **no buyer email anywhere in it**.

There is now direct runtime proof the old code was dead, not merely wrong. Posting a legacy
`{"action": "membership.went_valid", ...}` body at the handler logs:

```
[whop] ignored event type: (none)
```

`(none)` because there is no `type` key on it. Every real delivery the old handler ever
received fell straight through to the final `return { received: true }` without touching a
single line of grant logic. Combined with the blank `WHOP_WEBHOOK_SECRET`, the webhook has
had two independent reasons never to have worked.

One search result did surface `membership.went_valid`/`went_invalid` as if current. It was
summarising older docs and third-party tutorials, and it contradicted the concrete JSON
example on the field name itself (`event` vs `type`). I went with the JSON and your reading.

---

## STEP 0 — Webhook event handling

**File:** `app/api/whop/webhook/route.ts`

### 0b — Event routing (done)
`payload.type === 'payment.succeeded'` grants, `payload.type === 'payment.canceled'` revokes.
Anything else logs its type and returns 200 so Whop stops retrying events we ignore.

**This closes report item 1.1** (refund/chargeback never revokes access) in the same change,
as instructed — no separate step.

### 0c — Idempotency key (done)
Now `data.id`, the `pay_...` payment id. The Prisma column is still `lsOrderId` — no
migration — and its comment now says what it actually holds and why the name is a Lemon
Squeezy leftover.

### 0d — Buyer identification (**deliberately unfinished — needs you**)

This is the part I refused to guess at. The old code read
`data.user.email ?? data.email`; neither path exists in any documented Whop payload, which
is why it produced `''` every time. Swapping one invented path for another would have
reproduced the same class of bug with fresh confidence.

What is in the code instead:

1. **`CONFIRMED_EMAIL_PATHS` is an empty array.** `resolveBuyerEmail()` iterates it, so it
   always returns `null` right now. **No payment is auto-matched to an account.**
2. **`findEmailCandidates()`** walks the real payload on every delivery and logs every
   email-shaped value with its exact dot-path. Depth- and count-bounded so a large payload
   can't turn logging into a CPU sink.
3. Once you paste me a real delivery, adding one string to that array switches auto-granting
   on. Nothing else changes.

Proof the discovery works — a payload with an email buried three levels down produced:

```
[whop][DIAGNOSTIC] email-shaped values at: data.checkout.buyer.contact_email = BUYER@Example.com
```

That is exactly the line that will tell us the real field name.

**What happens to a real purchase in the meantime:** the payment is recorded as a pending
`Purchase` row keyed on the payment id, and the buyer unlocks through the self-serve claim
form — which independently verifies they own the email against their verified Clerk
addresses. Money is never lost, and nobody can claim someone else's purchase. What they
don't get is the instant auto-unlock. Since the current handler auto-unlocks for **zero**
buyers, this is strictly better than today, but it is not the finished state.

If exactly one email-shaped value is found, it is captured into `Purchase.buyerEmail` to feed
the claim form. That capture is safe even if it's the wrong value: `/api/whop/claim` requires
the claimant to own the address as a **verified** Clerk email, so a bad capture can only fail
to match — it can never hand access to a stranger.

**Do I need a Whop API call?** Unknown, and I did not add one speculatively. If the real
payload turns out to carry only `data.member.id` and no email anywhere, then yes — resolving
`mem_...` to an email needs a server-to-server Whop API call, which needs **a Whop API key
and a members-read scope that I do not have**. Do not provision that yet. One real delivery
tells us whether it's needed at all.

### 0e — Symmetric logging (done)
Grant and revoke now log at the same volume and with the same prefix:

```
[whop] ACCESS GRANTED -- user <id>, payment pay_xxx, matched via <path>
[whop] ACCESS REVOKED -- user <id>, refunded payment pay_xxx
[whop] PAYMENT RECORDED, ACCESS NOT GRANTED -- payment pay_xxx, member mem_xxx, ...
[whop] REFUND for unclaimed payment pay_xxx -- pending purchase voided
[whop] REFUND on payment pay_xxx ... other full_access purchase(s) on file -- access RETAINED
```

Two judgement calls in the revoke path worth knowing about:

- **Refund on an unclaimed purchase** clears `buyerEmail`, so a refunded payment can't be
  claimed afterwards.
- **A user with another `full_access` purchase on file keeps access**, and it's logged. One
  refund on a double purchase shouldn't lock out someone who genuinely paid twice. `Purchase`
  has no `status` column, so "still paid" is inferred from the other row's existence. Modelling
  refunds properly needs a `status` column — a migration, not today's job.

---

## STEP 1 — Items 2.1 to 2.4

### 2.1 Email casing (done)
Lowercased (and trimmed) at all three write sites: `webhooks/clerk`, `analyze`, `user/usage`.
The Whop webhook's lookup is now
`findFirst({ where: { email: { equals, mode: 'insensitive' } }, orderBy: { createdAt: 'asc' } })`.

The `orderBy` is 2.2's "at minimum" recommendation — with no unique constraint, `findFirst`
without an order returns an arbitrary row on a tie. It now deterministically resolves to the
oldest account.

**Bonus fix in the Clerk webhook:** it was reading `email_addresses[0]`, which is not
guaranteed to be the primary address and frequently isn't after an email change. A new
`pickPrimaryEmail()` resolves via `primary_email_address_id` and falls back to index 0. This
matters specifically for 2.3 — without it, `user.updated` could have refreshed the column
with the *old* address.

### 2.2 Unique constraint (comment only, as instructed)
No constraint added. `prisma/schema.prisma` now carries a comment on `User.email` explaining
the gap, why the migration needs a duplicate check first, and what compensates for it today.

### 2.3 `user.updated` (done)
`user.created` and `user.updated` now share one branch. The `upsert`'s `update` clause touches
**only `email`** — `parseCount`, `parseLimit` and `hasFullAccess` survive a profile edit
untouched. The pending-purchase recovery now runs on updates too, so someone who paid with an
address they added to their account afterwards gets picked up automatically. The claim itself
was changed to `updateMany` with `userId: null` still in the WHERE, so two concurrent
deliveries can't both claim one purchase.

### 2.4 apply-preview metering — **I chose (b), consume a real credit**

Why: it's the smaller change by a wide margin. Option (a) needs a new column, a migration and
a second reset/refill concept; (b) reuses the atomic conditional `UPDATE` already proven in
`/api/analyze` and adds no schema surface. Full-access users are unaffected and unlimited.

It follows the same discipline as `/api/analyze`: the credit is spent **after** validation, so
a malformed request can't cost one, and a `finally` block **refunds** it if Groq times out or
throws.

**The tradeoff you should agree with before shipping this.** A free user now gets 3 credits
total across *both* analyses and previews — analyse, preview, analyse, and they're out. That
is a real product change: previews used to feel free. If you'd rather they stay separate,
it's one column (`previewCount Int @default(0)`) plus swapping the two SQL statements — say
the word and it's a ten-minute change. I went with (b) because you asked for the smaller one.

### One-time backfill script (written, not run)
`prisma/backfill-lowercase-emails.sql`. **I have not run anything against your database.**

```bash
npx prisma db execute --schema prisma/schema.prisma --file prisma/backfill-lowercase-emails.sql
```

Read it before running. It leads with a safety check for accounts that differ **only** by
casing — lowercasing those would create true duplicates in a column with no unique
constraint. If that query returns rows, stop and decide which account is real first. It also
normalises `Purchase.buyerEmail`, and it's idempotent.

---

## STEP 2 — Hardening

### 3.1 Security headers (done, verified live)
`headers()` in `next.config.js`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin` on `/:path*`. No CSP, as instructed —
there's a comment saying why. Confirmed present on both a page and an API route against a
running server.

### 3.2 Filename logging (done)
`console.log` in `/api/analyze` now records size and MIME type only. `grep` confirms no
remaining `file.name` in any log line.

---

## Verified vs assumed

**Verified by running it:**

| Check | Result |
| --- | --- |
| `tsc --noEmit --skipLibCheck` after every patch | 0 errors, every time |
| `next build` | passes, all 22 routes |
| Signature verification regression (7 cases) | all pass — unchanged by this work |
| Event routing (5 cases) | all pass |
| Legacy `action` payload is now ignored | confirmed — logs `ignored event type: (none)` |
| Email discovery finds a nested path | confirmed — reported `data.checkout.buyer.contact_email` |
| Security headers on page + API route | confirmed present |

**Verified against Whop's published payload, not a live delivery:**
the `type` field, the envelope shape, `data.id` as `pay_...`, `data.member.id` as `mem_...`,
and the absence of any email field. Good enough to code the routing against. Not good enough
to code buyer matching against, which is why I didn't.

**Assumed, flag it if you disagree:**

- **`payment.canceled` is the right revoke event.** This comes from your reading of the live
  docs; my own search could confirm `payment.succeeded` but not `payment.canceled`. Confirm it
  from the event checklist in the Whop dashboard when you configure the endpoint — if the name
  differs, it's a one-line change.
- **`amountCents: 499` is still hardcoded.** The documented example exposes
  `amount_after_fees` (net of fees), and there's no verified gross-amount field. Reading one
  would have been exactly the kind of guess you ruled out.
- **Whether resolving `member.id` → email needs a Whop API call.** Unknown until we see a real
  payload.

**Not tested, because it would write to your production database:**
no test sent a `payment.succeeded` with a valid `data.id` — that path calls
`prisma.purchase.upsert` and `DATABASE_URL` points at production. I stopped short rather than
leave fake purchase rows in your data. Every branch *before* the DB write is covered above.

---

## What I stopped on

**One thing, and it's STEP 0d.** I need one real signed delivery before finalising the buyer
email path.

1. Set `WHOP_WEBHOOK_SECRET` in Vercel (still blank — this is the third report to say so).
2. Deploy this branch.
3. Make one real $4.99 purchase.
4. Find this line in the Vercel logs and paste it back to me:

```
[whop][DIAGNOSTIC] type=payment.succeeded payload={...}
```

Redact whatever you like except the **key names** — I need the structure, not the values. The
line immediately after it (`email-shaped values at: ...`) may well answer it on its own.

Then I add one string to `CONFIRMED_EMAIL_PATHS`, delete the diagnostic block, and
auto-granting works. That's the whole remaining change.

**The diagnostic logging must come out afterwards.** It prints the full payload — including
buyer PII — into Vercel's log retention. It runs after signature verification, so only
genuinely Whop-signed payloads are ever logged, but leaving it in permanently would undercut
3.2, which this same session just fixed.

---

## Git commands — run these yourself

I have not staged, committed or pushed anything. Review first:

```bash
git status
git diff
```

Note `CANDIDAI_FIX_REPORT.md`, `README.md`, `.npmrc`, `lib/constants.ts`, `lib/rate-limit.ts`,
`app/api/user/data/` and `prisma/backfill-lowercase-emails.sql` are untracked — `git add -A`
picks them up. `.npmrc` is required for a clean `npm ci` on Vercel; don't drop it.

```bash
git add -A
git commit -m "fix: correct Whop webhook events, revoke on refund, email casing, security headers

Webhook was keyed on payload.action === 'membership.went_valid'. Whop's
discriminator is `type` and that event does not exist, so every real
delivery no-opped. Now handles payment.succeeded (grant) and
payment.canceled (revoke), keyed on the payment id from data.id.

Buyer email matching is deliberately unresolved: no documented Whop
payload contains an email, so CONFIRMED_EMAIL_PATHS ships empty and
payments are recorded as pending for the claim flow. Temporary diagnostic
logging captures one real payload to close this.

- Revoke access on refund/chargeback (report 1.1)
- Lowercase email at all write sites; case-insensitive webhook lookup
  with deterministic orderBy (2.1, 2.2)
- Handle user.updated, resolving the primary address properly (2.3)
- apply-preview now spends a real credit instead of only reading one (2.4)
- X-Frame-Options, X-Content-Type-Options, Referrer-Policy (3.1)
- Drop filename from analyze logs (3.2)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -u origin fix/launch-blockers
```

Deploy order that matters: **set `WHOP_WEBHOOK_SECRET` before the test purchase**, and run the
email backfill before or immediately after deploying, so the case-insensitive lookup and the
stored data agree.
