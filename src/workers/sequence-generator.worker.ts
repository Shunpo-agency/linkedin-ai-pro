import { Worker } from 'bullmq'
import { redis } from './redis'
import { createServiceClient } from '@/lib/supabase/service'
import { generateMessageSequence, analyzeProfile } from '@/core/ai/claude.client'
import type { GeneratedSequence } from '@/core/ai/claude.client'

interface SequenceGeneratorJob {
  userId: string
  prospectId: string
  campaignId?: string
}

export const sequenceGeneratorWorker = new Worker<SequenceGeneratorJob>(
  'generate-sequence',
  async (job) => {
    const { userId, prospectId, campaignId } = job.data
    console.log(`[sequence-generator] Generating sequence for prospect ${prospectId}`)

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

    // Fetch business settings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: settings } = await (supabase as any)
      .from('business_settings')
      .select('business_name, business_description, offers, ai_behavior, calendar_link')
      .eq('user_id', userId)
      .single()

    // Get campaign AI behavior if available
    let campaignAiBehavior: Record<string, unknown> | null = null
    if (campaignId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: campaign } = await (supabase as any)
        .from('campaigns')
        .select('ai_behavior')
        .eq('id', campaignId)
        .single()
      campaignAiBehavior = campaign?.ai_behavior as Record<string, unknown> | null
    }

    const tone = (campaignAiBehavior?.tone as string) ?? (settings?.ai_behavior as Record<string, unknown>)?.tone as string ?? 'professional'
    const calendarLink = (settings?.calendar_link as string) ?? null

    // Use existing profile_analysis if available
    let profileAnalysis = prospect.profile_analysis as Record<string, unknown> | null
    if (!profileAnalysis || Object.keys(profileAnalysis).length === 0) {
      // Run profile analysis inline
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

    const sequence: GeneratedSequence = await generateMessageSequence({
      profile: {
        firstName: prospect.first_name as string | null,
        lastName: prospect.last_name as string | null,
        headline: prospect.job_title as string | null,
        company: prospect.company as string | null,
        industry: prospect.industry as string | null,
      },
      profileAnalysis,
      businessContext: {
        businessName: settings?.business_name as string | null,
        businessDescription: settings?.business_description as string | null,
        offers: settings?.offers as Array<{ title: string; description: string }> | null,
      },
      tone,
      calendarLink,
    })

    // Store sequence steps in message_sequences table
    const now = new Date()
    const steps = [
      { step: 1, ...sequence.step_1 },
      { step: 2, ...sequence.step_2 },
      { step: 3, ...sequence.step_3 },
      { step: 4, ...sequence.step_4 },
    ]

    const rows = steps.map((s) => {
      const scheduledAt = new Date(now)
      scheduledAt.setDate(scheduledAt.getDate() + s.day_offset)
      return {
        user_id: userId,
        prospect_id: prospectId,
        campaign_id: campaignId ?? null,
        step: s.step,
        content: s.content,
        status: 'pending',
        scheduled_at: scheduledAt.toISOString(),
      }
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('message_sequences')
      .insert(rows)

    if (error) {
      throw new Error(`Failed to store sequence: ${error.message}`)
    }

    console.log(`[sequence-generator] Generated 4-step sequence for prospect ${prospectId}`)
    return { generated: 4, prospectId }
  },
  {
    connection: redis,
    concurrency: 5,
  },
)

sequenceGeneratorWorker.on('failed', (job, err) => {
  console.error(`[sequence-generator] Job ${job?.id} failed:`, err.message)
})
