import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { BusinessSettings, UpdateSettings, Offer, PersonaConfig, AiBehavior } from './settings.types'
import type { Json } from '@/shared/types/database.types'

function castRow(row: Record<string, unknown>): BusinessSettings {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    business_name: (row.business_name as string | null) ?? null,
    business_description: (row.business_description as string | null) ?? null,
    offers: Array.isArray(row.offers) ? (row.offers as Offer[]) : [],
    main_features: Array.isArray(row.main_features)
      ? (row.main_features as string[])
      : [],
    business_model: (row.business_model as string | null) ?? null,
    target_persona: row.target_persona
      ? (row.target_persona as PersonaConfig)
      : null,
    ai_behavior: row.ai_behavior
      ? (row.ai_behavior as AiBehavior)
      : undefined,
    calendar_link: (row.calendar_link as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

export async function getByUser(
  userId: string,
): Promise<BusinessSettings | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('business_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch settings: ${error.message}`)
  }

  if (data === null) {
    return null
  }

  return castRow(data as Record<string, unknown>)
}

export async function upsert(
  userId: string,
  data: UpdateSettings,
): Promise<BusinessSettings> {
  // Service client to bypass RLS — userId is always validated by the caller.
  const supabase = createServiceClient()

  // Build a partial payload: only include fields that are explicitly provided
  // (not undefined). This prevents one page from accidentally overwriting
  // another page's fields with null.
  const payload: Record<string, unknown> = {
    user_id: userId,
    updated_at: new Date().toISOString(),
  }

  if (data.business_name !== undefined)
    payload.business_name = data.business_name ?? null

  if (data.business_description !== undefined)
    payload.business_description = data.business_description ?? null

  if (data.offers !== undefined)
    payload.offers = data.offers as unknown as Json

  if (data.main_features !== undefined)
    payload.main_features = data.main_features as unknown as Json

  if (data.business_model !== undefined)
    payload.business_model = data.business_model ?? null

  if (data.target_persona !== undefined)
    payload.target_persona = (data.target_persona ?? null) as unknown as Json

  if (data.ai_behavior !== undefined)
    payload.ai_behavior = data.ai_behavior as unknown as Json

  if (data.calendar_link !== undefined)
    payload.calendar_link = data.calendar_link ?? null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: upserted, error } = await (supabase as any)
    .from('business_settings')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) {
    console.error('[settings.upsert] Supabase error:', JSON.stringify(error))
    throw new Error(`Failed to upsert settings: ${error.message}`)
  }

  return castRow(upserted as Record<string, unknown>)
}
