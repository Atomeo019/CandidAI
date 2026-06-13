import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';

// ── Stripe client ──────────────────────────────────────────────────────────────

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not set');
  return new Stripe(key, { apiVersion: '2024-06-20' });
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface VerifySuccess {
  ok:          true;
  paid:        boolean;
  customer_email: string | null;
  amount_paid: number;   // cents
}

interface VerifyError {
  ok:    false;
  error: string;
  code:  string;
}

// ── GET handler ────────────────────────────────────────────────────────────────
// Called by /cover-letter page on mount to confirm the session is paid.
// /cover-letter?session_id=xxx → GET /api/stripe/verify-session?session_id=xxx

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get('session_id');

    if (!sessionId || !sessionId.startsWith('cs_')) {
      return NextResponse.json<VerifyError>(
        { ok: false, error: 'Invalid or missing session ID.', code: 'INVALID_SESSION' },
        { status: 400 }
      );
    }

    const stripe  = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const paid = session.payment_status === 'paid';

    return NextResponse.json<VerifySuccess>({
      ok:             true,
      paid,
      customer_email: session.customer_details?.email ?? null,
      amount_paid:    session.amount_total ?? 0,
    });

  } catch (e: any) {
    console.error('verify-session error:', e?.message);

    // Stripe throws StripeInvalidRequestError for bad session IDs
    if (e?.type === 'StripeInvalidRequestError') {
      return NextResponse.json<VerifyError>(
        { ok: false, error: 'Session not found.', code: 'SESSION_NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json<VerifyError>(
      { ok: false, error: 'Could not verify payment. Please contact support.', code: 'VERIFY_FAILED' },
      { status: 500 }
    );
  }
}
