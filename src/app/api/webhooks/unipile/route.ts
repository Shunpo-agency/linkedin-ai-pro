/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import {
  getConversationReplyQueue,
  getSuggestReplyQueue,
  getLeadScorerQueue,
} from '@/lib/queue-client'

// Unipile webhook event schema (simplified — covers MESSAGE_CREATED and CONNECTION_ACCEPTED)
const UnipileWebhookSchema = z.object({
  event: z.string(),
  data: z.object({
    account_id: z.string().optional(),
    message_id: z.string().optional(),
    sender_id: z.string().optional(),
    content: z.string().optional(),
    thread_id: z.string().optional(),
    timestamp: z.string().optional(),
  }),
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb(): any {
  return createServiceClient() as any
}

/**
 * Read the full_auto flag from a user's ai_behavior settings.
 * Returns false (semi-auto mode) if the setting is absent.
 */
async function isFullAutoEnabled(userId: string): Promise<boolean> {
  const { data } = await sb()
    .from('business_settings')
    .select('ai_behavior')
    .eq('user_id', userId)
    .maybeSingle()

  if (!data?.ai_behavior) return false
  const behavior =
    typeof data.ai_behavior === 'object' && !Array.isArray(data.ai_behavior)
      ? (data.ai_behavior as Record<string, unknown>)
      : null
  return behavior?.fullAuto === true
}

/**
 * Record an intent signal for a prospect.
 */
async function recordIntentSignal(
  userId: string,
  prospectId: string,
  signalType: string,
  points: number,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await sb().from('intent_signals').insert({
    user_id: userId,
    prospect_id: prospectId,
    signal_type: signalType,
    points,
    occurred_at: new Date().toISOString(),
    metadata: metadata ?? null,
  })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Validate Unipile webhook signature (optional if you set a shared secret)
    const signature = req.headers.get('x-unipile-signature')
    const webhookSecret = process.env.UNIPILE_WEBHOOK_SECRET
    if (webhookSecret && signature !== webhookSecret) {
      return NextResponse.json({ error: 'Invalid signature', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const body: unknown = await req.json()
    const parsed = UnipileWebhookSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', code: 'BAD_REQUEST' }, { status: 400 })
    }

    const { event, data } = parsed.data

    // ── MESSAGE_CREATED ─────────────────────────────────────────────────────
    if (event === 'MESSAGE_CREATED' && data.account_id && data.content) {
      const { data: linkedinAccount } = await sb()
        .from('linkedin_accounts')
        .select('user_id')
        .eq('unipile_account_id', data.account_id)
        .single()

      if (!linkedinAccount) {
        return NextResponse.json({ received: true })
      }

      const userId: string = linkedinAccount.user_id

      if (data.sender_id) {
        const { data: prospect } = await sb()
          .from('prospects')
          .select('id')
          .eq('user_id', userId)
          .eq('linkedin_id', data.sender_id)
          .single()

        if (prospect) {
          const prospectId: string = prospect.id

          // Save the inbound message record
          const { data: savedMsg } = await sb()
            .from('messages')
            .insert({
              user_id: userId,
              prospect_id: prospectId,
              direction: 'inbound',
              channel: 'linkedin',
              content: data.content,
              unipile_message_id: data.message_id ?? null,
              sent_at: data.timestamp ?? new Date().toISOString(),
              ai_generated: false,
            })
            .select('id')
            .single()

          const inboundMessageId: string | undefined = (savedMsg as { id: string } | null)?.id

          // Record intent signal: prospect replied
          await recordIntentSignal(userId, prospectId, 'message_replied', 25)

          // Branch: full-auto sends immediately, semi-auto creates a suggestion
          const fullAuto = await isFullAutoEnabled(userId)

          if (fullAuto) {
            // Full-auto mode: generate + queue reply immediately
            await getConversationReplyQueue().add('reply-inbound', { userId, prospectId })
            console.log(
              `[webhooks/unipile] Full-auto reply queued for prospect ${prospectId}`,
            )
          } else {
            // Semi-auto mode: generate suggestion for user review in /replies
            await getSuggestReplyQueue().add('suggest-inbound', {
              userId,
              prospectId,
              inboundMessageId,
            })
            console.log(
              `[webhooks/unipile] Semi-auto: reply suggestion queued for prospect ${prospectId}`,
            )
          }

          // Always re-score the lead after a new inbound signal
          await getLeadScorerQueue().add('score-after-reply', { userId, prospectId })
        }
      }
    }

    // ── CONNECTION_ACCEPTED ─────────────────────────────────────────────────
    if (event === 'CONNECTION_ACCEPTED' && data.account_id && data.sender_id) {
      const { data: linkedinAccount } = await sb()
        .from('linkedin_accounts')
        .select('user_id')
        .eq('unipile_account_id', data.account_id)
        .single()

      if (linkedinAccount) {
        const userId: string = linkedinAccount.user_id

        // Update connection status
        await sb()
          .from('prospects')
          .update({ connection_status: 'connected', updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('linkedin_id', data.sender_id)

        const { data: prospect } = await sb()
          .from('prospects')
          .select('id')
          .eq('user_id', userId)
          .eq('linkedin_id', data.sender_id)
          .single()

        if (prospect) {
          // Record intent signal: connection accepted (+15 pts)
          await recordIntentSignal(userId, prospect.id, 'connection_accepted', 15)

          console.log(
            `[webhooks/unipile] Connection accepted by prospect ${prospect.id} — status updated`,
          )
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('webhooks/unipile error:', message)
    return NextResponse.json({ error: message, code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
