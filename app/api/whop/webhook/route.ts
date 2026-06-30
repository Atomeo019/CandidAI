import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

// Whop signs webhooks with HMAC SHA256.
// Header: "whop-signature" = hex digest of HMAC(secret, raw_body)

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // ── Signature verification ─────────────────────────────────────────────────
  const secret = process.env.WHOP_WEBHOOK_SECRET;
  if (!secret) {
    console.error('WHOP_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const signature = req.headers.get('whop-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing whop-signature header' }, { status: 400 });
  }

  const hmac   = crypto.createHmac('sha256', secret);
  const digest = Buffer.from(hmac.update(rawBody).digest('hex'), 'utf8');
  const sigBuf = Buffer.from(signature, 'utf8');

  if (digest.length !== sigBuf.length || !crypto.timingSafeEqual(digest, sigBuf)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // ── Parse payload ──────────────────────────────────────────────────────────
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const action: string = payload?.action ?? '';

  // membership.went_valid fires when a one-time purchase completes and the
  // membership becomes active — this is our purchase confirmation event.
  if (action === 'membership.went_valid') {
    const membership = payload?.data ?? {};
    const email: string  = (membership?.user?.email ?? membership?.email ?? '').toLowerCase().trim();
    const membershipId: string = membership?.id ?? '';

    if (!email) {
      console.warn('whop membership.went_valid: no email in payload', membershipId);
      return NextResponse.json({ received: true });
    }

    try {
      const user = await prisma.user.findFirst({ where: { email } });

      if (!user) {
        // Buyer used a different email than their CandidAI account.
        // Store a pending purchase so they can self-serve claim it from the dashboard.
        try {
          await (prisma.purchase.upsert as any)({
            where: { lsOrderId: membershipId },
            create: {
              userId:       null,
              buyerEmail:   email,
              type:         'full_access',
              lsOrderId:    membershipId,
              creditsAdded: 0,
              amountCents:  499,
            },
            update: {},
          });
          console.warn('Whop sale: stored as pending purchase for email', email, 'membership:', membershipId);
        } catch (err: any) {
          console.error('DB write failed for pending Whop purchase:', err?.message);
          return NextResponse.json({ error: 'DB write failed' }, { status: 500 });
        }
        return NextResponse.json({ received: true });
      }

      // Idempotent — lsOrderId stores the Whop membership ID
      await (prisma.purchase.upsert as any)({
        where: { lsOrderId: membershipId },
        create: {
          userId:       user.id,
          type:         'full_access',
          lsOrderId:    membershipId,
          creditsAdded: 0,
          amountCents:  499,
        },
        update: {},
      });

      await prisma.user.update({
        where: { id: user.id },
        data:  { hasFullAccess: true } as any,
      });

      console.log('Full access granted to user', user.id, 'via Whop membership', membershipId);
    } catch (err: any) {
      console.error('DB write failed for Whop membership:', err?.message);
      // Return 500 so Whop retries the webhook
      return NextResponse.json({ error: 'DB write failed' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
