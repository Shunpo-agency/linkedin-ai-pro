import { createClient } from '@/lib/supabase/server'
import type { Campaign, CreateCampaign, UpdateCampaign, AgentRun } from './campaigns.types'
import type { Json } from '@/shared/types/database.types'

type IncrementableField =
  | 'prospects_count'
  | 'messages_sent'
  | 'replies_count'
  | 'meetings_booked'

export async function getAll(userId: string): Promise<Campaign[]> {
  const supabase = createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('campaigns')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch campaigns: ${error.message}`)
  }

  return data as Campaign[]
}

export async function getById(
  userId: string,
  id: string,
): Promise<Campaign | null> {
  const supabase = createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('campaigns')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Failed to fetch campaign: ${error.message}`)
  }

  return data as Campaign
}

export async function create(
  userId: string,
  data: CreateCampaign,
): Promise<Campaign> {
  const supabase = createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: created, error } = await (supabase as any)
    .from('campaigns')
    .insert({
      name: data.name,
      type: data.type ?? 'outreach',
      status: data.status,
      persona_snapshot: (data.persona_snapshot ?? null) as unknown as Json,
      audience_filters: (data.audience_filters ?? null) as unknown as Json,
      daily_invite_limit: data.daily_invite_limit ?? 15,
      ai_behavior: (data.ai_behavior ?? {}) as unknown as Json,
      user_id: userId,
      prospects_count: 0,
      messages_sent: 0,
      replies_count: 0,
      meetings_booked: 0,
      started_at: new Date().toISOString(),
      ended_at: null,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create campaign: ${error.message}`)
  }

  return created as Campaign
}

export async function update(
  userId: string,
  id: string,
  data: UpdateCampaign,
): Promise<Campaign> {
  const supabase = createClient()

  const payload: Record<string, unknown> = {}

  if (data.name !== undefined) payload.name = data.name
  if (data.status !== undefined) {
    payload.status = data.status
    if (data.status === 'completed') payload.ended_at = new Date().toISOString()
  }
  if (data.persona_snapshot !== undefined) {
    payload.persona_snapshot = data.persona_snapshot as unknown as Json
  }
  if (data.audience_filters !== undefined) {
    payload.audience_filters = data.audience_filters as unknown as Json
  }
  if (data.daily_invite_limit !== undefined) {
    payload.daily_invite_limit = data.daily_invite_limit
  }
  if (data.ai_behavior !== undefined) {
    payload.ai_behavior = data.ai_behavior as unknown as Json
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = await (supabase as any)
    .from('campaigns')
    .update(payload)
    .eq('user_id', userId)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update campaign: ${error.message}`)
  }

  return updated as Campaign
}

export async function remove(userId: string, id: string): Promise<void> {
  const supabase = createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('campaigns')
    .delete()
    .eq('user_id', userId)
    .eq('id', id)

  if (error) {
    throw new Error(`Failed to delete campaign: ${error.message}`)
  }
}

export async function updateStatus(
  userId: string,
  id: string,
  status: 'active' | 'paused' | 'completed',
): Promise<Campaign> {
  return update(userId, id, { status })
}

export async function getActivity(
  userId: string,
  campaignId: string,
  limit = 50,
): Promise<AgentRun[]> {
  const supabase = createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('agent_runs')
    .select('id, campaign_id, intent_type, status, result, error, started_at, completed_at')
    .eq('user_id', userId)
    .eq('campaign_id', campaignId)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to fetch activity: ${error.message}`)
  }

  return (data ?? []) as AgentRun[]
}

export async function incrementStats(
  id: string,
  field: IncrementableField,
): Promise<void> {
  const supabase = createClient()

  const { data: current, error: fetchError } = await supabase
    .from('campaigns')
    .select(field)
    .eq('id', id)
    .single()

  if (fetchError) {
    throw new Error(`Failed to fetch campaign for increment: ${fetchError.message}`)
  }

  const currentValue = (current as Record<string, unknown>)[field] as number

  const { error: updateError } = await supabase
    .from('campaigns')
    .update({ [field]: currentValue + 1 })
    .eq('id', id)

  if (updateError) {
    throw new Error(`Failed to increment campaign stat ${field}: ${updateError.message}`)
  }
}
