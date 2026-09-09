import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { WebhookEvent } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { FREE_PARSE_LIMIT } from '@/lib/constants'

// Clerk hands back every address on the profile; index 0 is not guaranteed to be
// the primary one, and after an email change it frequently is not. Resolve the
// primary explicitly, then lowercase — every write of User.email goes through
// this so casing can never drift back in.
function pickPrimaryEmail(data: any): string {
  const addresses: any[] = Array.isArray(data?.email_addresses) ? data.email_addresses : []
  const primaryId = data?.primary_email_address_id
  const primary = addresses.find((a) => a?.id === primaryId) ?? addresses[0]
  return (primary?.email_address ?? '').toLowerCase().trim()
}

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

  if (event.type === 'user.created' || event.type === 'user.updated') {
    const { id } = event.data
    // Normalised at the write site. Postgres string equality is case-sensitive
    // and Clerk returns whatever casing the OAuth provider supplied, so storing
    // "Name@Gmail.com" here is what made the Whop webhook's lookup miss.
    const email = pickPrimaryEmail(event.data)

    if (!id) {
      console.error(`[clerk webhook] ${event.type} with no user id`)
      return NextResponse.json({ error: 'Missing user id' }, { status: 400 })
    }

    try {
      // upsert instead of create — idempotent on Clerk webhook retries, and it
      // doubles as the user.updated handler: an email change in Clerk now
      // refreshes the stored column instead of leaving it stale forever.
      // `update` deliberately touches only email — parseCount, parseLimit and
      // hasFullAccess must survive a profile edit untouched.
      await prisma.user.upsert({
        where:  { id },
        create: { id, email, parseLimit: FREE_PARSE_LIMIT },
        update: { email },
      })
      console.log(`[clerk webhook] ${event.type}: ${id}`)

      // Apply any pending Whop purchase for this email (email mismatch recovery).
      // Runs on user.updated too: someone who paid with an address they only
      // added to their account afterwards now gets picked up automatically.
      const pending = await (prisma.purchase.findFirst as any)({
        where: {
          buyerEmail: { equals: email, mode: 'insensitive' },
          userId:     null,
          type:       'full_access',
        },
      })
      if (pending) {
        // userId still null in the WHERE so two concurrent deliveries cannot
        // both claim the same purchase.
        const { count } = await (prisma.purchase.updateMany as any)({
          where: { id: pending.id, userId: null },
          data:  { userId: id },
        })
        if (count > 0) {
          await prisma.user.update({ where: { id }, data: { hasFullAccess: true } as any })
          console.log('[clerk webhook] applied pending Whop purchase to user', id)
        }
      }
    } catch (err: any) {
      console.error(`[clerk webhook] ${event.type} DB error:`, err?.message)
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
