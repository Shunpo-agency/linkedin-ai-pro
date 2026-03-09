import { Worker } from 'bullmq'
import { redis } from './redis'
import { messageSenderQueue } from './queues'
import { generateAndSendReply } from '@/core/agent/actions/ai.actions'
import { createServiceClient } from '@/lib/supabase/service'

interface ConversationReplyJob {
  userId: string
  prospectId: string
}

export const conversationReplyWorker = new Worker<ConversationReplyJob>(
  'conversation-reply',
  async (job) => {
    const { userId, prospectId } = job.data
    console.log(`[conversation-reply] Generating reply for prospect ${prospectId}`)

    // Generate the AI reply (fetches context, calls Claude, returns text)
    const content = await generateAndSendReply(userId, prospectId)

    // Save the outbound message record immediately (before the delayed send)
    const supabase = createServiceClient()
    await supabase.from('messages').insert({
      user_id: userId,
      prospect_id: prospectId,
      direction: 'outbound',
      channel: 'linkedin',
      content,
      ai_generated: true,
      sent_at: new Date().toISOString(),
    })

    // Queue for actual sending with a human-like delay (2–10 minutes)
    const delayMs = Math.floor(Math.random() * 8 * 60 * 1000) + 2 * 60 * 1000
    await messageSenderQueue.add(
      'send-conversation-reply',
      { userId, prospectId, content },
      { delay: delayMs },
    )

    console.log(
      `[conversation-reply] Reply generated and queued for prospect ${prospectId} ` +
        `(sending in ~${Math.round(delayMs / 60000)} min)`,
    )

    return { prospectId, content: content.slice(0, 80) + '…' }
  },
  {
    connection: redis,
    concurrency: 5,
  },
)

conversationReplyWorker.on('failed', (job, err) => {
  console.error(`[conversation-reply] Job ${job?.id} failed:`, err.message)
})
