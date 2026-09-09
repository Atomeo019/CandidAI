import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { FREE_PARSE_LIMIT } from '@/lib/constants'

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let user = await prisma.user.findUnique({ where: { id: userId } })

  // Clerk webhook can lag or fail -- create the DB record on-demand so the
  // first signed-in parse is never wrongly blocked by a missing row.
  if (!user) {
    const clerkUser = await currentUser()
    // Lowercased at the write site -- see the Whop webhook's case-sensitive
    // lookup, which this is what used to silently miss.
    const email = (clerkUser?.emailAddresses?.[0]?.emailAddress ?? '').toLowerCase().trim()
    user = await prisma.user.upsert({
      where: { id: userId },
      create: { id: userId, email, parseLimit: FREE_PARSE_LIMIT },
      update: {},
    })
  }

  // hasFullAccess exists in schema -- cast to access it without type errors
  const fullAccess: boolean = Boolean((user as Record<string, unknown>).hasFullAccess)

  return NextResponse.json({
    parseCount: user.parseCount,
    parseLimit: user.parseLimit,
    remaining: fullAccess ? 9999 : Math.max(0, user.parseLimit - user.parseCount),
    hasFullAccess: fullAccess,
  })
}
