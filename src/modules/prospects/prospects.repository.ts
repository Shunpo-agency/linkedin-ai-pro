import { createClient } from '@/lib/supabase/server'
import type { Prospect, CreateProspect, UpdateProspect, ProspectFilters } from './prospects.types'

export async function getAll(
  userId: string,
  filters?: ProspectFilters,
): Promise<Prospect[]> {
  const supabase = await createClient()

  let query = supabase
    .from('prospects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (filters?.temperature !== undefined) {
    query = query.eq('temperature', filters.temperature)
  }

  if (filters?.booking_status !== undefined) {
    query = query.eq('booking_status', filters.booking_status)
  }

  if (filters?.connection_status !== undefined) {
    query = query.eq('connection_status', filters.connection_status)
  }

  if (filters?.industry !== undefined) {
    query = query.eq('industry', filters.industry)
  }

  if (filters?.search !== undefined && filters.search.trim() !== '') {
    const term = `%${filters.search.trim()}%`
    query = query.or(
      `first_name.ilike.${term},last_name.ilike.${term},company.ilike.${term}`,
    )
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch prospects: ${error.message}`)
  }

  return data as Prospect[]
}

export async function getById(
  userId: string,
  id: string,
): Promise<Prospect | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('prospects')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Failed to fetch prospect: ${error.message}`)
  }

  return data as Prospect
}

export async function create(
  userId: string,
  data: CreateProspect,
): Promise<Prospect> {
  const supabase = await createClient()

  const { data: created, error } = await supabase
    .from('prospects')
    .insert({ ...data, user_id: userId })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create prospect: ${error.message}`)
  }

  return created as Prospect
}

export async function update(
  userId: string,
  id: string,
  data: UpdateProspect,
): Promise<Prospect> {
  const supabase = await createClient()

  const { data: updated, error } = await supabase
    .from('prospects')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update prospect: ${error.message}`)
  }

  return updated as Prospect
}

export async function updateScore(
  userId: string,
  id: string,
  score: number,
  temperature: 'cold' | 'warm' | 'hot',
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('prospects')
    .update({
      lead_score: score,
      temperature,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('id', id)

  if (error) {
    throw new Error(`Failed to update prospect score: ${error.message}`)
  }
}

export async function getCount(userId: string): Promise<number> {
  const supabase = await createClient()

  const { count, error } = await supabase
    .from('prospects')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Failed to count prospects: ${error.message}`)
  }

  return count ?? 0
}

export async function getCountByTemperature(
  userId: string,
): Promise<{ cold: number; warm: number; hot: number }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('prospects')
    .select('temperature')
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Failed to count prospects by temperature: ${error.message}`)
  }

  const result = { cold: 0, warm: 0, hot: 0 }

  for (const row of data ?? []) {
    const temp = row.temperature as 'cold' | 'warm' | 'hot'
    if (temp in result) {
      result[temp]++
    }
  }

  return result
}
