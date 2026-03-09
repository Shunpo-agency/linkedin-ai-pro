import { Worker } from 'bullmq'
import { redis } from './redis'
import { createServiceClient } from '@/lib/supabase/service'
import { findAndCreateProspects } from '@/core/agent/actions/linkedin.actions'
import { generateAndQueueMessage } from '@/core/agent/actions/ai.actions'
import { messageSenderQueue, prospectDiscoveryQueue } from './queues'
import type { PersonaConfig } from '@/core/agent/intents/types'

interface ProspectDiscoveryJob {
  userId: string
  limit?: number
}

export const prospectDiscoveryWorker = new Worker<ProspectDiscoveryJob>(
  'prospect-discovery',
  async (job) => {
    const { userId, limit = 20 } = job.data

    // ── Dispatcher pattern: "all" → one job per active user ─────────────────
    if (userId === 'all') {
      const supabase = createServiceClient()
      const { data: accounts } = await supabase
        .from('linkedin_accounts')
        .select('user_id')
        .eq('status', 'active')

      const users = accounts ?? []
      console.log(`[prospect-discovery] Dispatching jobs for ${users.length} active users`)

      for (const acc of users) {
        await prospectDiscoveryQueue.add('daily-discovery', {
          userId: acc.user_id as string,
          limit,
        })
      }
      return { dispatched: users.length }
    }

    console.log(`[prospect-discovery] Running for user ${userId}, limit ${limit}`)

    const supabase = createServiceClient()

    // ── Guard: LinkedIn account required ─────────────────────────────────────
    const { data: linkedinAccount } = await supabase
      .from('linkedin_accounts')
      .select('unipile_account_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    if (!linkedinAccount) {
      console.log('[prospect-discovery] No active LinkedIn account — skipping')
      return { created: 0, queued: 0 }
    }

    // ── Get persona config ────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: settings } = await (supabase as any)
      .from('business_settings')
      .select('target_persona')
      .eq('user_id', userId)
      .single()

    if (!settings?.target_persona) {
      console.log('[prospect-discovery] No target persona configured — skipping')
      return { created: 0, queued: 0 }
    }

    const persona = settings.target_persona as unknown as PersonaConfig

    // ── Exclude already-known prospects ──────────────────────────────────────
    const { data: existing } = await supabase
      .from('prospects')
      .select('linkedin_id')
      .eq('user_id', userId)
      .not('linkedin_id', 'is', null)

    const excludeIds = (existing ?? [])
      .map((p) => (p as { linkedin_id: string | null }).linkedin_id as string)
      .filter(Boolean)

    // ── Discover new prospects via Unipile ───────────────────────────────────
    const result = await findAndCreateProspects(userId, persona, limit, excludeIds)
    console.log(`[prospect-discovery] Created ${result.created} new prospects`)

    if (result.created === 0) {
      return { ...result, queued: 0 }
    }

    // ── Queue connection requests for the newly found prospects ──────────────
    // Fetch the freshest not_connected prospects (those just created)
    const { data: newProspects } = await supabase
      .from('prospects')
      .select('id')
      .eq('user_id', userId)
      .eq('connection_status', 'not_connected')
      .eq('source', 'ai_search')
      .order('created_at', { ascending: false })
      .limit(limit)

    let queued = 0

    for (const prospect of newProspects ?? []) {
      try {
        const prospectId = (prospect as { id: string }).id

        // Generate a personalized opener / connection note via Claude
        const openerMessage = await generateAndQueueMessage(userId, prospectId)

        // Stagger requests: 4 min apart + up to 2 min jitter (human-like pacing)
        const staggerMs = queued * 4 * 60 * 1000
        const jitterMs = Math.floor(Math.random() * 2 * 60 * 1000)

        await messageSenderQueue.add(
          'connection-request',
          {
            userId,
            prospectId,
            content: openerMessage,
            type: 'connection_request' as const,
          },
          { delay: staggerMs + jitterMs },
        )

        queued++
      } catch (err) {
        console.error(
          `[prospect-discovery] Failed to queue connection request for ${(prospect as { id: string }).id}:`,
          err,
        )
      }
    }

    console.log(`[prospect-discovery] Queued ${queued} connection requests`)
    return { ...result, queued }
  },
  {
    connection: redis,
    concurrency: 1,
  },
)

prospectDiscoveryWorker.on('failed', (job, err) => {
  console.error(`[prospect-discovery] Job ${job?.id} failed:`, err.message)
})
