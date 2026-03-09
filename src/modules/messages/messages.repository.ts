import { createClient } from '@/lib/supabase/server'
import type { Message, CreateMessage } from './messages.types'

export type MessageWithProspect = Message & {
  prospect_id: string
  prospect: {
    id: string
    first_name: string | null
    last_name: string | null
    company: string | null
    job_title: string | null
    temperature: string
    profile_picture_url: string | null
  }
}

export async function getByProspect(
  userId: string,
  prospectId: string,
): Promise<Message[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('user_id', userId)
    .eq('prospect_id', prospectId)
    .order('sent_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch messages for prospect: ${error.message}`)
  }

  return data as Message[]
}

export async function getAll(
  userId: string,
  limit?: number,
): Promise<MessageWithProspect[]> {
  const supabase = await createClient()

  let query = supabase
    .from('messages')
    .select(
      `
      *,
      prospect:prospects!prospect_id (
        id,
        first_name,
        last_name,
        company,
        job_title,
        temperature,
        profile_picture_url
      )
    `,
    )
    .eq('user_id', userId)
    .order('sent_at', { ascending: false })

  if (limit !== undefined) {
    query = query.limit(limit)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch messages: ${error.message}`)
  }

  return data as unknown as MessageWithProspect[]
}

export async function create(
  userId: string,
  data: CreateMessage,
): Promise<Message> {
  const supabase = await createClient()

  const { data: created, error } = await supabase
    .from('messages')
    .insert({ ...data, user_id: userId })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create message: ${error.message}`)
  }

  return created as Message
}

export async function createBatch(
  userId: string,
  data: CreateMessage[],
): Promise<Message[]> {
  const supabase = await createClient()

  const rows = data.map((d) => ({ ...d, user_id: userId }))

  const { data: created, error } = await supabase
    .from('messages')
    .insert(rows)
    .select()

  if (error) {
    throw new Error(`Failed to batch-create messages: ${error.message}`)
  }

  return created as Message[]
}

export async function getLastOutbound(
  userId: string,
  prospectId: string,
): Promise<Message | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('user_id', userId)
    .eq('prospect_id', prospectId)
    .eq('direction', 'outbound')
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch last outbound message: ${error.message}`)
  }

  return data as Message | null
}
