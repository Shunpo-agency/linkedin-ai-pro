/* eslint-disable @typescript-eslint/no-explicit-any */
import * as repo from './suggested-replies.repository'
import { getMessageSenderQueue } from '@/lib/queue-client'
import { createServiceClient } from '@/lib/supabase/service'
import type { SuggestedReplyWithProspect } from './suggested-replies.types'

function db(): any {
  return createServiceClient() as any
}

export async function getPendingReplies(
  userId: string,
): Promise<SuggestedReplyWithProspect[]> {
  return repo.getPending(userId)
}

export async function countPendingReplies(userId: string): Promise<number> {
  return repo.countPending(userId)
}

/**
 * Approve a suggestion (with optional edits), save the message to the DB,
 * and queue the actual LinkedIn send.
 */
export async function approveReply(
  userId: string,
  id: string,
  finalContent: string,
): Promise<void> {
  const suggestion = await repo.getById(userId, id)
  if (!suggestion) {
    throw new Error(`Suggested reply ${id} not found`)
  }

  // Mark approved in DB
  await repo.approve(userId, id, finalContent)

  // Save outbound message
  await db().from('messages').insert({
    user_id: userId,
    prospect_id: suggestion.prospect_id,
    direction: 'outbound',
    channel: 'linkedin',
    content: finalContent,
    ai_generated: true,
    sent_at: new Date().toISOString(),
  })

  // Queue actual send with a short human-like delay (30 s – 3 min)
  const delayMs = Math.floor(Math.random() * 2.5 * 60 * 1000) + 30 * 1000
  await getMessageSenderQueue().add(
    'send-approved-reply',
    { userId, prospectId: suggestion.prospect_id, content: finalContent },
    { delay: delayMs },
  )
}

export async function ignoreReply(userId: string, id: string): Promise<void> {
  return repo.ignore(userId, id)
}
