import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';

// ── Stripe client ──────────────────────────────────────────────────────────────
// Secret key lives in env only — never exposed to client.

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not set');
  return new Stripe(key, { apiVersion: '2024-06-20' });
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface CheckoutRequest {
  // We don't need to pass JD/analysis here — the client stores them in
  // localStorage before redirecting, and the /cover-letter page reads them back.
  // This keeps the Stripe session lean and avoids metadata size limits.
  return_path?: string;   // path to redirect back to on cancel (default: /results)
}

interface CheckoutSuccess {
  ok:  true;
  url: string;   // Stripe Checkout URL — client does window.location.href = url
}

interface CheckoutError {
  ok:    false;
  error: string;
  code:  string;
}

// ── POST handler ───────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    let body: Partial<CheckoutRequest> = {};
    try { body = await req.json(); } catch { /* body is optional */ }

    const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';

    const returnPath = typeof body.return_path === 'string' ? body.return_path : '/results';

    const stripe = getStripe();

    // Price in cents — configurable via env var.
    // Default: $4.99 (internship-audience price point, low friction, validates willingness to pay).
    const amountCents = parseInt(process.env.COVER_LETTER_PRICE_CENTS ?? '499', 10);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency:     'usd',
            unit_amount:  amountCents,
            product_data: {
              name:        'Full Tailored Cover Letter',
              description: '3 complete paragraphs, personalized to your target job description. Instant download.',
              images:      [],
            },
          },
          quantity: 1,
        },
      ],
      // session_id injected by Stripe — client reads it on the success page
      success_url: `${origin}/cover-letter?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${origin}${returnPath}`,
      // Metadata for debugging + future analytics — not used for auth
      metadata: {
        product: 'cover_letter_v1',
      },
      customer_email: undefined,
    });

    if (!session.url) {
      throw new Error('Stripe did not return a checkout URL');
    }

    return NextResponse.json<CheckoutSuccess>({ ok: true, url: session.url });

  } catch (e: any) {
    console.error('create-checkout error:', e?.message);
    return NextResponse.json<CheckoutError>(
      { ok: false, error: 'Failed to create checkout session. Please try again.', code: 'STRIPE_FAILED' },
      { status: 500 }
    );
  }
}
