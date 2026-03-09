import { Worker } from 'bullmq'
import { redis } from './redis'
import { generateAndSendReply } from '@/core/agent/actions/ai.actions'
import { createServiceClient } from '@/lib/supabase/service'

interface SuggestReplyJob {
  userId: string
  prospectId: string
  inboundMessageId?: string
}

export const suggestReplyWorker = new Worker<SuggestReplyJob>(
  'suggest-reply',
  async (job) => {
    const { userId, prospectId, inboundMessageId } = job.data
    console.log(`[suggest-reply] Generating suggestion for prospect ${prospectId}`)

    // Reuse the same generation function as auto-reply — same quality, same context
    const suggestedContent = await generateAndSendReply(userId, prospectId)

    // Save as a pending suggestion — the user will review it in the UI
    const supabase = createServiceClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any
    const { error } = await supabaseAny
      .from('ai_suggested_replies')
      .insert({
        user_id: userId,
        prospect_id: prospectId,
        inbound_message_id: inboundMessageId ?? null,
        suggested_content: suggestedContent,
        status: 'pending',
        created_at: new Date().toISOString(),
      })

    if (error) {
      throw new Error(`[suggest-reply] Failed to save suggestion: ${error.message}`)
    }

    console.log(
      `[suggest-reply] Suggestion saved for prospect ${prospectId} — awaiting review`,
    )

    return { prospectId, preview: suggestedContent.slice(0, 80) + '…' }
  },
  {
    connection: redis,
    concurrency: 5,
  },
)

suggestReplyWorker.on('failed', (job, err) => {
  console.error(`[suggest-reply] Job ${job?.id} failed:`, err.message)
})
