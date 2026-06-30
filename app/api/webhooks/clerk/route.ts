import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { WebhookEvent } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Missing CLERK_WEBHOOK_SECRET' }, { status: 500 })
  }

  const svixId        = req.headers.get('svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp')
  const svixSignature = req.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 })
  }

  const body = await req.text()
  const wh = new Webhook(webhookSecret)

  let event: WebhookEvent
  try {
    event = wh.verify(body, {
      'svix-id':        svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as WebhookEvent
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'user.created') {
    const { id, email_addresses } = event.data
    const email = email_addresses?.[0]?.email_address ?? ''
    try {
      // upsert instead of create — idempotent on Clerk webhook retries
      await prisma.user.upsert({
        where: { id },
        create: { id, email },
        update: { email },
      })
      console.log('[clerk webhook] user created/updated:', id, email)

      // Apply any pending Whop purchase for this email (email mismatch recovery)
      const pending = await (prisma.purchase.findFirst as any)({
        where: { buyerEmail: email.toLowerCase(), userId: null, type: 'full_access' },
      })
      if (pending) {
        await (prisma.purchase.update as any)({ where: { id: pending.id }, data: { userId: id } })
        await prisma.user.update({ where: { id }, data: { hasFullAccess: true } as any })
        console.log('[clerk webhook] applied pending Whop purchase to new user', id)
      }
    } catch (err: any) {
      console.error('[clerk webhook] user.created DB error:', err?.message)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }
  }

  if (event.type === 'user.deleted') {
    const { id } = event.data
    if (id) {
      try {
        await prisma.user.delete({ where: { id } })
        console.log('[clerk webhook] user deleted:', id)
      } catch (err: any) {
        // P2025 = record not found — already deleted, safe to ignore
        if (!err?.message?.includes('P2025')) {
          console.error('[clerk webhook] user.deleted DB error:', err?.message)
          return NextResponse.json({ error: 'DB error' }, { status: 500 })
        }
      }
    }
  }

  return NextResponse.json({ received: true })
}
