import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

// DELETE /api/user/data — self-serve erasure of stored analysis history.
//
// The privacy policy tells users they can have their data deleted. Until this
// route existed that meant emailing and waiting for a manual psql session.
//
// Scope: deletes the caller's Analysis rows only. The User row and any Purchase
// records survive on purpose — deleting the User row would cascade the
// purchase away and silently revoke paid access, and purchase records are kept
// for tax and chargeback reasons. Account deletion itself belongs to Clerk,
// whose user.deleted webhook already cascades everything.

export async function DELETE() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { count } = await prisma.analysis.deleteMany({ where: { userId } })
    console.log(`[user/data] deleted ${count} analysis row(s) for ${userId}`)
    return NextResponse.json({ ok: true, deleted: count })
  } catch (err: any) {
    console.error('[user/data] DB error:', err?.message)
    return NextResponse.json({ ok: false, error: 'Could not delete your data. Please try again.' }, { status: 500 })
  }
}
