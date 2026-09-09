import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/analyses — the signed-in user's own analysis history.
//
// The POST that used to live here took whatever `analysis` JSON the browser
// sent and wrote the scores straight to the database, so anyone could store
// themselves a perfect result. Persistence now happens inside /api/analyze from
// the normalized server-side result, and this route is read-only.
//
// Scoped to the caller's userId — there is deliberately no way to request
// another user's rows.

const DEFAULT_LIMIT = 20
const MAX_LIMIT     = 50

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const requested = Number(req.nextUrl.searchParams.get('limit'))
  const take = Number.isFinite(requested) && requested > 0
    ? Math.min(Math.floor(requested), MAX_LIMIT)
    : DEFAULT_LIMIT

  try {
    const rows = await prisma.analysis.findMany({
      where:   { userId },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id:            true,
        createdAt:     true,
        detectedRole:  true,
        tier:          true,
        contentScore:  true,
        atsScore:      true,
        roastHeadline: true,
        topPriority:   true,
      },
    })

    return NextResponse.json({ ok: true, analyses: rows })
  } catch (err: any) {
    console.error('[analyses] DB error:', err?.message)
    return NextResponse.json({ ok: false, error: 'Could not load your history.' }, { status: 500 })
  }
}
