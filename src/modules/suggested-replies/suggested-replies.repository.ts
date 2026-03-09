/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from '@/lib/supabase/service'
import type { SuggestedReplyWithProspect } from './suggested-replies.types'

function db(): any {
  return createServiceClient() as any
}

export async function getPending(userId: string): Promise<SuggestedReplyWithProspect[]> {
  const { data, error } = await db()
    .from('ai_suggested_replies')
    .select(`
      *,
      prospect:prospects (
        first_name,
        last_name,
        job_title,
        company,
        linkedin_profile_url
      ),
      inbound_message:messages (
        content,
        sent_at
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch pending replies: ${error.message}`)
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    user_id: row.user_id as string,
    prospect_id: row.prospect_id as string,
    inbound_message_id: (row.inbound_message_id as string | null) ?? null,
    suggested_content: row.suggested_content as string,
    status: row.status as string,
    final_content: (row.final_content as string | null) ?? null,
    reviewed_at: (row.reviewed_at as string | null) ?? null,
    created_at: row.created_at as string,
    prospect: row.prospect as SuggestedReplyWithProspect['prospect'],
    inbound_message: (row.inbound_message as SuggestedReplyWithProspect['inbound_message']) ?? null,
  }))
}

export async function countPending(userId: string): Promise<number> {
  const { count, error } = await db()
    .from('ai_suggested_replies')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'pending')

  if (error) {
    throw new Error(`Failed to count pending replies: ${error.message}`)
  }

  return count ?? 0
}

export async function approve(
  userId: string,
  id: string,
  finalContent: string,
): Promise<void> {
  const { error } = await db()
    .from('ai_suggested_replies')
    .update({
      status: 'approved',
      final_content: finalContent,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Failed to approve reply: ${error.message}`)
  }
}

export async function ignore(userId: string, id: string): Promise<void> {
  const { error } = await db()
    .from('ai_suggested_replies')
    .update({
      status: 'ignored',
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Failed to ignore reply: ${error.message}`)
  }
}

export async function getById(
  userId: string,
  id: string,
): Promise<{ prospect_id: string; suggested_content: string } | null> {
  const { data, error } = await db()
    .from('ai_suggested_replies')
    .select('id, prospect_id, suggested_content, status')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch reply: ${error.message}`)
  }

  return data as { prospect_id: string; suggested_content: string } | null
}
