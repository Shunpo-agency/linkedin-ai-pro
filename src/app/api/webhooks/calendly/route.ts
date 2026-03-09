import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'

const CalcomWebhookSchema = z.object({
  triggerEvent: z.string(),
  payload: z.object({
    bookingId: z.number().optional(),
    uid: z.string().optional(),
    attendees: z
      .array(
        z.object({
          email: z.string().optional(),
          name: z.string().optional(),
        }),
      )
      .optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Validate Cal.com webhook secret
    const secret = req.headers.get('x-cal-signature-256') ?? req.headers.get('x-webhook-secret')
    const webhookSecret = process.env.CALCOM_WEBHOOK_SECRET
    if (webhookSecret && secret !== webhookSecret) {
      return NextResponse.json({ error: 'Invalid signature', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const body: unknown = await req.json()
    const parsed = CalcomWebhookSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', code: 'BAD_REQUEST' }, { status: 400 })
    }

    const { triggerEvent, payload } = parsed.data
    const supabase = createServiceClient()

    // Cal.com sends BOOKING_CREATED and BOOKING_CANCELLED events
    if (triggerEvent === 'BOOKING_CREATED' && payload.uid) {
      const prospectId = (payload.metadata as Record<string, string> | undefined)?.prospect_id
      if (prospectId) {
        await supabase
          .from('prospects')
          .update({
            booking_status: 'booked',
            calendar_event_url: `https://cal.com/booking/${payload.uid}`,
          })
          .eq('id', prospectId)
      }
    }

    if (triggerEvent === 'BOOKING_CANCELLED' && payload.uid) {
      const prospectId = (payload.metadata as Record<string, string> | undefined)?.prospect_id
      if (prospectId) {
        await supabase
          .from('prospects')
          .update({
            booking_status: 'link_sent',
            calendar_event_url: null,
          })
          .eq('id', prospectId)
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('webhooks/calendly error:', message)
    return NextResponse.json({ error: message, code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
