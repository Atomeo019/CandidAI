import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

// Whop signs webhooks with HMAC SHA256 over the raw request body.
//
// Providers send this one of two ways and the exact shape has changed between
// Whop API versions, so both are accepted:
//   A) a bare hex digest       — "3f8a1c..."
//   B) a timestamped composite — "t=1710000000,v1=3f8a1c..."
// Both still require the shared secret to produce, so accepting either does not
// weaken verification. Which one matched is logged, so a glance at the logs
// after the first real sale confirms the integration rather than leaving silent
// 401s to be discovered later.
//
// The composite form also carries a timestamp, which is what makes replay
// protection possible: a captured webhook stops being replayable once it ages
// past the tolerance below. The `lsOrderId` unique constraint is the second
// line of defence — a replayed purchase can never double-credit.

const REPLAY_TOLERANCE_S = 5 * 60;

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

type VerifyResult =
  | { ok: true;  format: 'bare' | 'timestamped' }
  | { ok: false; reason: string };

function verifySignature(rawBody: string, header: string, secret: string): VerifyResult {
  const hmac = (payload: string) =>
    crypto.createHmac('sha256', secret).update(payload).digest('hex');

  // -- Format B: t=...,v1=... --------------------------------------------------
  if (header.includes('=')) {
    const parts = header.split(',').map((p) => p.trim());
    let timestamp: string | null = null;
    const candidates: string[] = [];

    for (const part of parts) {
      const eq = part.indexOf('=');
      if (eq === -1) continue;
      const key   = part.slice(0, eq).trim();
      const value = part.slice(eq + 1).trim();
      if (key === 't') timestamp = value;
      else if (key === 'v1' || key === 'v0' || key === 'sha256') candidates.push(value);
    }

    if (candidates.length === 0) return { ok: false, reason: 'no signature value in header' };

    if (timestamp) {
      const ts = Number(timestamp);
      if (!Number.isFinite(ts)) return { ok: false, reason: 'unparseable timestamp' };
      // Whop may send seconds or milliseconds; normalise to seconds.
      const tsSeconds  = ts > 1e12 ? Math.floor(ts / 1000) : ts;
      const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - tsSeconds);
      if (ageSeconds > REPLAY_TOLERANCE_S) {
        return { ok: false, reason: `timestamp outside tolerance (${ageSeconds}s old)` };
      }
    }

    // The signed payload is "<timestamp>.<body>" where a timestamp is present,
    // and the body alone otherwise. Both are checked because either is in use.
    const expected = timestamp
      ? [hmac(`${timestamp}.${rawBody}`), hmac(rawBody)]
      : [hmac(rawBody)];

    for (const candidate of candidates) {
      for (const digest of expected) {
        if (safeEqualHex(digest, candidate)) return { ok: true, format: 'timestamped' };
      }
    }
    return { ok: false, reason: 'signature mismatch' };
  }

  // -- Format A: bare hex digest -----------------------------------------------
  if (safeEqualHex(hmac(rawBody), header.trim())) return { ok: true, format: 'bare' };
  return { ok: false, reason: 'signature mismatch' };
}

// ---------------------------------------------------------------------------
// Buyer identification
//
// STATUS: UNRESOLVED. Whop's published payment.succeeded example contains no
// buyer email at all -- the only identity it carries is `data.member.id`
// ("mem_..."). The previous version of this file read
// `data.user.email ?? data.email`; neither path appears in any documented Whop
// payload, so it resolved to '' on every delivery.
//
// Rather than swap one guessed path for another, nothing here matches a buyer
// until a real signed delivery has been observed:
//
//   1. CONFIRMED_EMAIL_PATHS is empty, so resolveBuyerEmail always returns null
//      and no payment is ever matched to an account automatically.
//   2. findEmailCandidates walks the real payload and logs every email-shaped
//      value it finds together with its exact path, so one live purchase reveals
//      the true field name.
//   3. Add that path to CONFIRMED_EMAIL_PATHS and auto-granting switches on.
//      No other change is needed.
//
// Until step 3, buyers are recorded as pending purchases and unlock through the
// self-serve claim form, which verifies ownership independently.
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Dot-paths, relative to the webhook's `data` object, known to hold the buyer's
// email. EMPTY UNTIL VERIFIED AGAINST A REAL PAYLOAD -- do not add a path here
// because it looks plausible or because another payment provider uses it.
const CONFIRMED_EMAIL_PATHS: string[] = [];

type EmailCandidate = { path: string; value: string };

// Depth- and count-bounded so a hostile or unexpectedly large payload cannot
// turn logging into a CPU sink.
function findEmailCandidates(
  node: unknown,
  path = 'data',
  depth = 0,
  out: EmailCandidate[] = []
): EmailCandidate[] {
  if (depth > 6 || out.length >= 20) return out;

  if (typeof node === 'string') {
    if (EMAIL_RE.test(node)) out.push({ path, value: node });
    return out;
  }

  if (Array.isArray(node)) {
    for (let i = 0; i < node.length && out.length < 20; i++) {
      findEmailCandidates(node[i], `${path}[${i}]`, depth + 1, out);
    }
    return out;
  }

  if (node && typeof node === 'object') {
    const entries = Object.entries(node as Record<string, unknown>);
    for (let i = 0; i < entries.length && out.length < 20; i++) {
      findEmailCandidates(entries[i][1], `${path}.${entries[i][0]}`, depth + 1, out);
    }
  }

  return out;
}

function readPath(root: any, dotPath: string): unknown {
  const segments = dotPath.replace(/^data\./, '').split('.');
  let cursor: any = root;
  for (let i = 0; i < segments.length; i++) {
    if (cursor === null || typeof cursor !== 'object') return undefined;
    cursor = cursor[segments[i]];
  }
  return cursor;
}

function resolveBuyerEmail(data: any): { email: string; path: string } | null {
  for (let i = 0; i < CONFIRMED_EMAIL_PATHS.length; i++) {
    const path  = CONFIRMED_EMAIL_PATHS[i];
    const value = readPath(data, path);
    if (typeof value === 'string') {
      const email = value.toLowerCase().trim();
      if (EMAIL_RE.test(email)) return { email, path };
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // -- Signature verification --------------------------------------------------
  const secret = process.env.WHOP_WEBHOOK_SECRET;
  if (!secret) {
    console.error('WHOP_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const signature =
    req.headers.get('whop-signature') ??
    req.headers.get('x-whop-signature') ??
    req.headers.get('whop-webhook-signature');

  if (!signature) {
    // Logging the header names (never the values) turns "no sales are landing"
    // into a one-glance diagnosis.
    const names: string[] = [];
    req.headers.forEach((_value, key) => { names.push(key); });
    console.error('Whop webhook: no signature header found. Headers present:', names.join(', '));
    return NextResponse.json({ error: 'Missing whop-signature header' }, { status: 400 });
  }

  const verified = verifySignature(rawBody, signature, secret);
  if (!verified.ok) {
    console.error('Whop webhook rejected:', verified.reason);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
  console.log(`Whop webhook signature verified (${verified.format} format)`);

  // -- Parse payload -----------------------------------------------------------
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Whop's envelope is { id, type, api_version, timestamp, account_id, data }.
  // The event discriminator is `type`. This handler previously read `action`,
  // which does not exist on a Whop payload — so `action` was always '' and the
  // handler silently no-opped on every real delivery it has ever received.
  const eventType: string = typeof payload?.type === 'string' ? payload.type : '';
  const data: any = payload?.data ?? {};

  // For payment.* events `data.id` is the payment id ("pay_..."). That is the
  // idempotency key: unique per payment, stable across Whop's retries.
  const paymentId: string = typeof data?.id === 'string' ? data.id : '';

  // ---------------------------------------------------------------------------
  // TEMPORARY DIAGNOSTIC -- REMOVE ONCE CONFIRMED_EMAIL_PATHS IS POPULATED
  //
  // No documented Whop payment payload contains a buyer email; the published
  // example carries only `data.member.id` ("mem_..."). Rather than guess a field
  // path, this logs one real signed delivery so the actual shape can be read off
  // and CONFIRMED_EMAIL_PATHS filled in from fact.
  //
  // It runs AFTER signature verification, so only genuinely Whop-signed payloads
  // are ever logged. It does print buyer PII into Vercel's log retention -- that
  // is the point of it, and it is why it must come out once the path is known.
  // ---------------------------------------------------------------------------
  console.log(`[whop][DIAGNOSTIC] type=${eventType} payload=${JSON.stringify(payload)}`);

  const candidates = findEmailCandidates(data);
  if (candidates.length > 0) {
    console.log(
      '[whop][DIAGNOSTIC] email-shaped values at:',
      candidates.map((c) => `${c.path} = ${c.value}`).join(' | ')
    );
  } else {
    console.log('[whop][DIAGNOSTIC] no email-shaped value in data. member id:', data?.member?.id ?? '(none)');
  }

  // -- payment.succeeded: the purchase confirmation ----------------------------
  if (eventType === 'payment.succeeded') {
    if (!paymentId) {
      // Without an id there is no idempotency key, so a Whop retry would write a
      // second purchase row. 400 rather than record something undeduplicatable.
      console.error('[whop] payment.succeeded with no data.id -- cannot deduplicate');
      return NextResponse.json({ error: 'Missing payment id' }, { status: 400 });
    }

    // Only a CONFIRMED path yields a buyer. Until CONFIRMED_EMAIL_PATHS is
    // populated from a real delivery this is always null, and every payment is
    // recorded as pending for the self-serve claim flow rather than matched on a
    // guessed field.
    const buyer = resolveBuyerEmail(data);

    // Best-effort capture for the claim flow. Recording a candidate email is safe
    // even when it is the wrong one: /api/whop/claim independently requires the
    // claimant to own that address as a verified Clerk email, so a bad capture
    // can only fail to match -- it can never grant access to a stranger.
    const capturedEmail: string | null =
      buyer?.email ?? (candidates.length === 1 ? candidates[0].value.toLowerCase().trim() : null);

    try {
      let user: { id: string } | null = null;

      if (buyer) {
        // Case-insensitive match: Postgres string equality is case-sensitive and
        // Clerk returns whatever casing the OAuth provider supplied, so a stored
        // "Name@Gmail.com" would never equal an incoming "name@gmail.com".
        // orderBy pins the result -- User.email has no unique constraint and
        // findFirst without an order returns an arbitrary row on a tie.
        user = await prisma.user.findFirst({
          where:   { email: { equals: buyer.email, mode: 'insensitive' } },
          orderBy: { createdAt: 'asc' },
          select:  { id: true },
        });
      }

      // Idempotent on the payment id -- a Whop retry updates nothing.
      // amountCents is the known list price, not a value read from the payload:
      // the published example exposes `amount_after_fees` (net of fees) and no
      // verified gross-amount field, so reading one would be a guess.
      await (prisma.purchase.upsert as any)({
        where: { lsOrderId: paymentId },
        create: {
          userId:       user?.id ?? null,
          buyerEmail:   capturedEmail,
          type:         'full_access',
          lsOrderId:    paymentId,
          creditsAdded: 0,
          amountCents:  499,
        },
        update: {},
      });

      if (!user) {
        console.warn(
          `[whop] PAYMENT RECORDED, ACCESS NOT GRANTED -- payment ${paymentId}, member ${data?.member?.id ?? '(none)'}, captured email ${capturedEmail ?? '(none)'}. ` +
          'Buyer must use the claim form, or be granted manually. Populate CONFIRMED_EMAIL_PATHS to auto-grant.'
        );
        return NextResponse.json({ received: true });
      }

      await prisma.user.update({
        where: { id: user.id },
        data:  { hasFullAccess: true } as any,
      });

      console.log(`[whop] ACCESS GRANTED -- user ${user.id}, payment ${paymentId}, matched via ${buyer?.path}`);
    } catch (err: any) {
      console.error('[whop] DB write failed for payment.succeeded:', err?.message);
      // 500 so Whop retries the webhook
      return NextResponse.json({ error: 'DB write failed' }, { status: 500 });
    }

    return NextResponse.json({ received: true });
  }

  // -- payment.canceled: refund or chargeback, revoke access -------------------
  // Identity comes from the payment id, never from an email: this is the same row
  // written on payment.succeeded, so a buyer who has changed their email since
  // purchase is still revoked correctly.
  if (eventType === 'payment.canceled') {
    if (!paymentId) {
      console.error('[whop] payment.canceled with no data.id -- cannot identify the purchase');
      return NextResponse.json({ error: 'Missing payment id' }, { status: 400 });
    }

    try {
      const purchase = await (prisma.purchase.findUnique as any)({ where: { lsOrderId: paymentId } });

      if (!purchase) {
        // Nothing on file: either it predates this handler, or the succeeded
        // event never landed. Nothing to revoke -- 200 so Whop stops retrying.
        console.warn(`[whop] REFUND for unknown payment ${paymentId} -- no purchase row, nothing revoked`);
        return NextResponse.json({ received: true });
      }

      if (!purchase.userId) {
        // Recorded but never claimed, so no access was ever granted. Clearing the
        // captured email stops a refunded payment being claimable afterwards.
        await (prisma.purchase.update as any)({
          where: { id: purchase.id },
          data:  { buyerEmail: null },
        });
        console.warn(`[whop] REFUND for unclaimed payment ${paymentId} -- pending purchase voided, no access to revoke`);
        return NextResponse.json({ received: true });
      }

      // Someone who bought twice should not lose access because one payment was
      // refunded. Purchase has no status column, so "still paid" is inferred from
      // another full_access row on the same user.
      const otherPaid = await (prisma.purchase.count as any)({
        where: {
          userId:    purchase.userId,
          type:      'full_access',
          lsOrderId: { not: paymentId },
        },
      });

      if (otherPaid > 0) {
        console.warn(
          `[whop] REFUND on payment ${paymentId} for user ${purchase.userId}, but ${otherPaid} other full_access purchase(s) on file -- access RETAINED`
        );
        return NextResponse.json({ received: true });
      }

      await prisma.user.update({
        where: { id: purchase.userId },
        data:  { hasFullAccess: false } as any,
      });

      console.warn(`[whop] ACCESS REVOKED -- user ${purchase.userId}, refunded payment ${paymentId}`);
    } catch (err: any) {
      console.error('[whop] DB write failed for payment.canceled:', err?.message);
      return NextResponse.json({ error: 'DB write failed' }, { status: 500 });
    }

    return NextResponse.json({ received: true });
  }

  // Anything else is an event we do not act on. 200 so Whop stops retrying it.
  console.log(`[whop] ignored event type: ${eventType || '(none)'}`);
  return NextResponse.json({ received: true });
}
