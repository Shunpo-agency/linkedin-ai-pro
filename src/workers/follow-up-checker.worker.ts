import { Worker } from 'bullmq'
import { redis } from './redis'
import { createServiceClient } from '@/lib/supabase/service'
import { messageSenderQueue, followUpCheckerQueue } from './queues'
import { generateAndQueueMessage } from '@/core/agent/actions/ai.actions'

interface FollowUpCheckerJob {
  userId: string
  followUpDelayDays?: number
}

export const followUpCheckerWorker = new Worker<FollowUpCheckerJob>(
  'follow-up-checker',
  async (job) => {
    const { userId, followUpDelayDays = 3 } = job.data

    // ── Dispatcher pattern: "all" → one job per active user ─────────────────
    if (userId === 'all') {
      const supabase = createServiceClient()
      const { data: accounts } = await supabase
        .from('linkedin_accounts')
        .select('user_id')
        .eq('status', 'active')

      const users = accounts ?? []
      console.log(`[follow-up-checker] Dispatching jobs for ${users.length} active users`)

      for (const acc of users) {
        // Read each user's configured follow-up delay from their ai_behavior settings
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: settings } = await (supabase as any)
          .from('business_settings')
          .select('ai_behavior')
          .eq('user_id', acc.user_id)
          .maybeSingle()

        const userDelay: number =
          ((settings?.ai_behavior as Record<string, unknown> | null)
            ?.followUpDelayDays as number) ?? followUpDelayDays

        await followUpCheckerQueue.add('follow-up-check', {
          userId: acc.user_id as string,
          followUpDelayDays: userDelay,
        })
      }
      return { dispatched: users.length }
    }

    console.log(`[follow-up-checker] Checking follow-ups for user ${userId}`)

    const supabase = createServiceClient()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - followUpDelayDays)

    // Find connected prospects with no recent booking and no recent outbound message
    const { data: prospects } = await supabase
      .from('prospects')
      .select('id')
      .eq('user_id', userId)
      .eq('connection_status', 'connected')
      .eq('booking_status', 'none')
      .lt('updated_at', cutoffDate.toISOString())
      .limit(20)

    if (!prospects?.length) {
      console.log('[follow-up-checker] No prospects need follow-up')
      return { count: 0 }
    }

    let queued = 0
    for (const prospect of prospects) {
      try {
        const prospectId = (prospect as { id: string }).id

        // Skip if we already sent a message within the follow-up window
        const { data: recentMsg } = await supabase
          .from('messages')
          .select('id')
          .eq('user_id', userId)
          .eq('prospect_id', prospectId)
          .eq('direction', 'outbound')
          .gte('sent_at', cutoffDate.toISOString())
          .limit(1)

        if (recentMsg?.length) continue

        const content = await generateAndQueueMessage(userId, prospectId)

        // Stagger messages: 1 min apart (delay set at the job level, not via setTimeout)
        await messageSenderQueue.add(
          'follow-up',
          { userId, prospectId, content, type: 'message' as const },
          { delay: queued * 60 * 1000 },
        )
        queued++
      } catch (err) {
        console.error(
          `[follow-up-checker] Error for prospect ${(prospect as { id: string }).id}:`,
          err,
        )
      }
    }

    console.log(`[follow-up-checker] Queued ${queued} follow-ups`)
    return { count: queued }
  },
  {
    connection: redis,
    concurrency: 2,
  },
)

followUpCheckerWorker.on('failed', (job, err) => {
  console.error(`[follow-up-checker] Job ${job?.id} failed:`, err.message)
})
