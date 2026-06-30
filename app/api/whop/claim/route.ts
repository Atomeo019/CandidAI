import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

// POST /api/whop/claim
// Lets a signed-in user claim a pending purchase that was stored when their
// Whop buyer email didn't match their CandidAI account email at webhook time.
// Body: { buyerEmail: string }

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Sign in required.' }, { status: 401 });
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

    // Claim: link to this user + grant access
    await (prisma.purchase.update as any)({
      where: { id: pending.id },
      data: { userId },
    });

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
