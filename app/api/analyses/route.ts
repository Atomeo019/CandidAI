import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let analysis: Record<string, unknown>
  try {
    const body = await req.json()
    analysis = body.analysis ?? {}
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const saved = await prisma.analysis.create({
      data: {
        userId,
        detectedRole:     (analysis.detected_role     as string  | null) ?? null,
        tier:             (analysis.tier               as string  | null) ?? null,
        contentScore:     (analysis.content_score      as number  | null) ?? null,
        atsScore:         (analysis.ats_score          as number  | null) ?? null,
        roastHeadline:    (analysis.roast_headline     as string  | null) ?? null,
        roastBody:        (analysis.roast_body         as string  | null) ?? null,
        dimensionScores:  (analysis.dimension_scores   ?? null) as any,
        hiringPrediction: (analysis.hiring_prediction  ?? null) as any,
        redFlags:         (analysis.red_flags          ?? null) as any,
        strengths:        (analysis.strengths          ?? null) as any,
        topPriority:      (analysis.top_priority       as string  | null) ?? null,
      },
    })
    return NextResponse.json({ id: saved.id })
  } catch (err: any) {
    console.error('[analyses] DB error:', err?.message)
    return NextResponse.json({ error: 'Failed to save analysis' }, { status: 500 })
  }
}
