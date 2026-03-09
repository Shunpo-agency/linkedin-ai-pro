import { Worker } from 'bullmq'
import { redis } from './redis'
import { createServiceClient } from '@/lib/supabase/service'
import { scoreLeadFull, analyzeProfile } from '@/core/ai/claude.client'

interface LeadScorerJob {
  userId: string
  prospectId: string
  campaignId?: string
}

const TEMPERATURE_FROM_SCORE = (score: number): 'cold' | 'warm' | 'hot' => {
  if (score >= 70) return 'hot'
  if (score >= 40) return 'warm'
  return 'cold'
}

export const leadScorerWorker = new Worker<LeadScorerJob>(
  'lead-scorer',
  async (job) => {
    const { userId, prospectId } = job.data
    console.log(`[lead-scorer] Scoring prospect ${prospectId}`)

    const supabase = createServiceClient()

    // Fetch prospect data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: prospect } = await (supabase as any)
      .from('prospects')
      .select('*')
      .eq('id', prospectId)
      .eq('user_id', userId)
      .single()

    if (!prospect) {
      throw new Error(`Prospect ${prospectId} not found`)
    }

    // Fetch target persona from business settings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: settings } = await (supabase as any)
      .from('business_settings')
      .select('target_persona')
      .eq('user_id', userId)
      .single()

    // Use existing profile_analysis or run analysis first
    let profileAnalysis = prospect.profile_analysis as Record<string, unknown> | null
    if (!profileAnalysis || Object.keys(profileAnalysis).length === 0) {
      profileAnalysis = await analyzeProfile({
        profile: {
          firstName: prospect.first_name as string | null,
          lastName: prospect.last_name as string | null,
          headline: prospect.job_title as string | null,
          company: prospect.company as string | null,
          industry: prospect.industry as string | null,
          location: prospect.location as string | null,
        },
      }) as unknown as Record<string, unknown>
    }

    const scoreResult = await scoreLeadFull({
      profile: {
        firstName: prospect.first_name as string | null,
        lastName: prospect.last_name as string | null,
        headline: prospect.job_title as string | null,
        company: prospect.company as string | null,
        industry: prospect.industry as string | null,
        location: prospect.location as string | null,
      },
      profileAnalysis,
      targetPersona: settings?.target_persona as Record<string, string[]> | null,
    })

    const temperature = TEMPERATURE_FROM_SCORE(scoreResult.score)

    // Update prospect with score breakdown
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('prospects')
      .update({
        lead_score: scoreResult.score,
        temperature,
        score_breakdown: scoreResult,
        score_updated_at: new Date().toISOString(),
        profile_analysis: profileAnalysis,
        ai_notes: scoreResult.justification,
      })
      .eq('id', prospectId)

    console.log(`[lead-scorer] Score: ${scoreResult.score} (${temperature}) — ${scoreResult.recommended_action}`)
    return { score: scoreResult.score, temperature, recommended_action: scoreResult.recommended_action }
  },
  {
    connection: redis,
    concurrency: 10,
  },
)

leadScorerWorker.on('failed', (job, err) => {
  console.error(`[lead-scorer] Job ${job?.id} failed:`, err.message)
})
