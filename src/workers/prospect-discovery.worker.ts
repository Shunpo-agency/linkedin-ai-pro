import { Worker } from 'bullmq'
import { redis } from './redis'
import { createServiceClient } from '@/lib/supabase/service'
import { findAndCreateProspects } from '@/core/agent/actions/linkedin.actions'
import { generateAndQueueMessage } from '@/core/agent/actions/ai.actions'
import { messageSenderQueue, prospectDiscoveryQueue } from './queues'
import type { PersonaConfig } from '@/core/agent/intents/types'
import {
  isBusinessHours,
  spreadInvitesAcrossDay,
  startupJitterMs,
  LINKEDIN_DAILY_INVITE_LIMIT,
} from '@/lib/human-timing'

interface ProspectDiscoveryJob {
  userId: string
  limit?: number
  skipJitter?: boolean // true pour les déclenchements manuels
}

export const prospectDiscoveryWorker = new Worker<ProspectDiscoveryJob>(
  'prospect-discovery',
  async (job) => {
    const { userId, limit = LINKEDIN_DAILY_INVITE_LIMIT, skipJitter = false } = job.data

    // ── Dispatcher : "all" → un job par utilisateur actif ───────────────────
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

    // ── Anti-détection : vérifier les heures ouvrées ─────────────────────────
    if (!isBusinessHours()) {
      console.log('[prospect-discovery] Outside business hours — skipping to avoid LinkedIn detection')
      return { skipped: true, reason: 'outside_business_hours' }
    }

    // ── Anti-détection : jitter de démarrage (sauf déclenchement manuel) ────
    if (!skipJitter) {
      const jitter = startupJitterMs()
      console.log(`[prospect-discovery] Startup jitter: waiting ${Math.round(jitter / 60000)} min`)
      await new Promise((resolve) => setTimeout(resolve, jitter))
    }

    console.log(`[prospect-discovery] Running for user ${userId}, limit ${limit}`)
    const supabase = createServiceClient()

    // ── Guard : compte LinkedIn requis ───────────────────────────────────────
    const { data: linkedinAccount } = await supabase
      .from('linkedin_accounts')
      .select('unipile_account_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    if (!linkedinAccount) {
      console.log('[prospect-discovery] No active LinkedIn account — skipping')
      return { created: 0, queued: 0, error: 'no_linkedin_account' }
    }

    // ── Guard : persona configuré ────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: settings } = await (supabase as any)
      .from('business_settings')
      .select('target_persona')
      .eq('user_id', userId)
      .single()

    if (!settings?.target_persona) {
      console.log('[prospect-discovery] No target persona configured — skipping')
      return { created: 0, queued: 0, error: 'no_persona' }
    }

    const persona = settings.target_persona as unknown as PersonaConfig

    // ── Vérifier la limite journalière déjà atteinte ─────────────────────────
    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)

    const { count: todaySent } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('direction', 'outbound')
      .gte('created_at', todayStart.toISOString())

    const alreadySentToday = todaySent ?? 0
    const remainingToday = Math.max(0, LINKEDIN_DAILY_INVITE_LIMIT - alreadySentToday)

    if (remainingToday === 0) {
      console.log(`[prospect-discovery] Daily limit reached (${LINKEDIN_DAILY_INVITE_LIMIT}) — skipping`)
      return { created: 0, queued: 0, error: 'daily_limit_reached', sentToday: alreadySentToday }
    }

    const safeLimit = Math.min(limit, remainingToday)

    // ── Exclure les prospects déjà connus ────────────────────────────────────
    const { data: existing } = await supabase
      .from('prospects')
      .select('linkedin_id')
      .eq('user_id', userId)
      .not('linkedin_id', 'is', null)

    const excludeIds = (existing ?? [])
      .map((p) => (p as { linkedin_id: string | null }).linkedin_id as string)
      .filter(Boolean)

    // ── Découverte via Unipile ───────────────────────────────────────────────
    const result = await findAndCreateProspects(userId, persona, safeLimit, excludeIds)
    console.log(`[prospect-discovery] Created ${result.created} new prospects`)

    if (result.created === 0) {
      return { ...result, queued: 0 }
    }

    // ── Planifier les demandes de connexion avec délais humains ─────────────
    const { data: newProspects } = await supabase
      .from('prospects')
      .select('id')
      .eq('user_id', userId)
      .eq('connection_status', 'not_connected')
      .eq('source', 'ai_search')
      .order('created_at', { ascending: false })
      .limit(safeLimit)

    const prospects = newProspects ?? []
    // Délais étalés sur le reste de la journée (anti-détection)
    const delays = spreadInvitesAcrossDay(prospects.length)

    let queued = 0
    for (let i = 0; i < prospects.length; i++) {
      const prospect = prospects[i]
      try {
        const prospectId = (prospect as { id: string }).id
        const openerMessage = await generateAndQueueMessage(userId, prospectId)
        const delayMs = delays[i] ?? (i * 6 * 60_000) // fallback: 6 min entre chaque

        await messageSenderQueue.add(
          'connection-request',
          {
            userId,
            prospectId,
            content: openerMessage,
            type: 'connection_request' as const,
          },
          { delay: delayMs },
        )

        console.log(`[prospect-discovery] Queued invite for ${prospectId} in ${Math.round(delayMs / 60000)} min`)
        queued++
      } catch (err) {
        console.error(
          `[prospect-discovery] Failed to queue for ${(prospect as { id: string }).id}:`,
          err,
        )
      }
    }

    console.log(`[prospect-discovery] Queued ${queued} connection requests`)
    return { ...result, queued, sentToday: alreadySentToday, remainingToday }
  },
  {
    connection: redis,
    concurrency: 1,
  },
)

prospectDiscoveryWorker.on('failed', (job, err) => {
  console.error(`[prospect-discovery] Job ${job?.id} failed:`, err.message)
})
