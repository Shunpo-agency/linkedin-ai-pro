import { Worker } from 'bullmq'
import { redis } from './redis'
import { createServiceClient } from '@/lib/supabase/service'
import { refinePersonaSuggestions } from '@/core/ai/claude.client'
import { personaRefinerQueue } from './queues'
import type { PersonaConfig, CampaignPerformanceData } from '@/core/agent/intents/types'

interface PersonaRefinerJob {
  userId: string
}

export const personaRefinerWorker = new Worker<PersonaRefinerJob>(
  'persona-refiner',
  async (job) => {
    const { userId } = job.data

    // ── Dispatcher pattern: "all" → one job per active user ─────────────────
    if (userId === 'all') {
      const supabase = createServiceClient()
      const { data: accounts } = await supabase
        .from('linkedin_accounts')
        .select('user_id')
        .eq('status', 'active')

      const users = accounts ?? []
      console.log(`[persona-refiner] Dispatching jobs for ${users.length} active users`)

      for (const acc of users) {
        await personaRefinerQueue.add('weekly-persona-refine', {
          userId: acc.user_id as string,
        })
      }
      return { dispatched: users.length }
    }

    console.log(`[persona-refiner] Running for user ${userId}`)

    const supabase = createServiceClient()

    const { data: settings } = await supabase
      .from('business_settings')
      .select('target_persona')
      .eq('user_id', userId)
      .single()

    if (!settings?.target_persona) {
      console.log('[persona-refiner] No persona configured — skipping')
      return null
    }

    // Compute performance data
    const [
      { count: totalProspects },
      { count: messagesSent },
      { count: repliesCount },
      { count: meetingsBooked },
    ] = await Promise.all([
      supabase.from('prospects').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('direction', 'outbound'),
      supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('direction', 'inbound'),
      supabase
        .from('prospects')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('booking_status', 'booked'),
    ])

    const performanceData: CampaignPerformanceData = {
      totalProspects: totalProspects ?? 0,
      messagesSent: messagesSent ?? 0,
      repliesCount: repliesCount ?? 0,
      meetingsBooked: meetingsBooked ?? 0,
      replyRate:
        messagesSent && messagesSent > 0
          ? Math.round(((repliesCount ?? 0) / messagesSent) * 100)
          : 0,
    }

    const suggestions = await refinePersonaSuggestions({
      currentPersona: settings.target_persona as unknown as PersonaConfig,
      performanceData,
    })

    console.log(`[persona-refiner] Generated ${suggestions.suggestions.length} suggestions`)
    return suggestions
  },
  {
    connection: redis,
    concurrency: 1,
  },
)

personaRefinerWorker.on('failed', (job, err) => {
  console.error(`[persona-refiner] Job ${job?.id} failed:`, err.message)
})
