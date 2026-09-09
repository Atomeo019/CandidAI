import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

// POST /api/whop/claim
// Lets a signed-in user claim a pending purchase that was stored when their
// Whop buyer email didn't match their CandidAI account email at webhook time.
// Body: { buyerEmail: string }
//
// SECURITY — this route previously granted full access to whoever supplied a
// matching buyerEmail, with no proof they owned that address and no limit on
// guesses. Any signed-in account could claim every pending purchase in the
// table. The claimed address must now be one of the caller's OWN verified
// Clerk email addresses, which makes the purchase unclaimable by anyone else
// and makes enumeration pointless.

const CLAIM_RATE_LIMIT  = 5;
const CLAIM_RATE_WINDOW = 60_000;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Sign in required.' }, { status: 401 });
  }

  const limit = rateLimit(`whop-claim:${userId}`, CLAIM_RATE_LIMIT, CLAIM_RATE_WINDOW);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: `Too many attempts. Try again in ${limit.retryAfter}s.` },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    );
  }

  let body: { buyerEmail?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const buyerEmail = (body.buyerEmail ?? '').trim().toLowerCase();
  if (!buyerEmail || !buyerEmail.includes('@')) {
    return NextResponse.json({ ok: false, error: 'Valid email required.' }, { status: 422 });
  }

  // ── Ownership check ─────────────────────────────────────────────────────────
  // Only verified addresses count. An unverified one proves nothing — anyone can
  // add any address to a Clerk profile.
  const clerkUser = await currentUser();
  const ownedEmails = (clerkUser?.emailAddresses ?? [])
    .filter((e: any) => e?.verification?.status === 'verified')
    .map((e: any) => (e?.emailAddress ?? '').toLowerCase().trim())
    .filter(Boolean);

  if (!ownedEmails.includes(buyerEmail)) {
    console.warn(`[whop/claim] ${userId} attempted to claim an address they do not own`);
    return NextResponse.json(
      {
        ok: false,
        error:
          'That email is not verified on this account. Add it in your account settings and verify it, then claim again — or contact support with your Whop receipt.',
      },
      { status: 403 }
    );
  }

  try {
    // Find a pending purchase matching this email (userId = null means unclaimed)
    const pending = await (prisma.purchase.findFirst as any)({
      where: {
        buyerEmail,
        userId: null,
        type: 'full_access',
      },
    });

    if (!pending) {
      return NextResponse.json(
        { ok: false, error: 'No pending purchase found for that email. Make sure you enter the exact email used at checkout.' },
        { status: 404 }
      );
    }

    // Claim it. `userId: null` stays in the where clause so two concurrent
    // requests cannot both attach themselves to the same purchase — the second
    // one matches zero rows.
    const { count } = await (prisma.purchase.updateMany as any)({
      where: { id: pending.id, userId: null },
      data:  { userId },
    });

    if (count === 0) {
      return NextResponse.json(
        { ok: false, error: 'That purchase has already been claimed.' },
        { status: 409 }
      );
    }

    await prisma.user.update({
      where: { id: userId },
      data: { hasFullAccess: true } as any,
    });

    console.log('Purchase claimed: user', userId, 'claimed membership', pending.lsOrderId, 'from email', buyerEmail);
    return NextResponse.json({ ok: true });

  } catch (err: any) {
    console.error('DB error in /api/whop/claim:', err?.message);
    return NextResponse.json({ ok: false, error: 'Server error. Please try again.' }, { status: 500 });
  }
}
