import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'

export async function POST() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { parseCount: { increment: 1 } },
  })

  return NextResponse.json({ parseCount: user.parseCount })
}
