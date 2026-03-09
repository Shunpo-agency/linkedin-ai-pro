// ─────────────────────────────────────────────────────────────────────────────
// LinkedIn actions — wraps Unipile client calls with Supabase DB operations.
// All functions operate in the context of a specific user (userId).
//
// Note: The project's Database type is missing the PostgrestVersion key required
// by supabase-js v2.98+, causing table types to resolve to `never`.
// We use `as unknown as T` casts on query results and `db()` helper with
// eslint-disable for writes — the same pattern used across this codebase.
// ─────────────────────────────────────────────────────────────────────────────

import { createServiceClient } from '@/lib/supabase/service'
import {
  searchLinkedInProfiles,
  sendConnectionRequest as unipileSendConnectionRequest,
  sendLinkedInMessage as unipileSendLinkedInMessage,
  getAccountMessages,
} from '@/core/linkedin/unipile.client'
import type { PersonaConfig } from '@/core/agent/intents/types'

// ---------------------------------------------------------------------------
// Type aliases for DB rows
// ---------------------------------------------------------------------------

interface LinkedInAccountRow {
  id: string
  unipile_account_id: string
}

interface ProspectRow {
  id: string
  linkedin_id: string | null
}

interface MessageRow {
  id: string
  unipile_message_id: string | null
}

interface LatestMessageRow {
  sent_at: string
}

interface ProspectMapRow {
  id: string
  linkedin_id: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any {
  return createServiceClient() as unknown
}

async function getLinkedInAccount(userId: string): Promise<LinkedInAccountRow> {
  const supabase = db()

  const { data, error } = await supabase
    .from('linkedin_accounts')
    .select('id, unipile_account_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('connected_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    throw new Error(
      `linkedin.actions: no active LinkedIn account found for user ${userId}`,
    )
  }

  return data as LinkedInAccountRow
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/**
 * Search Unipile for LinkedIn profiles matching the persona, then create
 * prospect records in the DB for any profiles not already tracked.
 * Returns the count of newly created prospect records.
 */
export async function findAndCreateProspects(
  userId: string,
  persona: PersonaConfig,
  limit: number,
  excludeIds: string[],
): Promise<{ created: number }> {
  const supabase = db()

  const profiles = await searchLinkedInProfiles({
    keywords: persona.keywords,
    roles: persona.roles,
    industries: persona.industries,
    locations: persona.locations,
    companySizes: persona.companySizes,
    limit,
  })

  const newProfiles = profiles.filter((p) => !excludeIds.includes(p.id))

  if (newProfiles.length === 0) {
    return { created: 0 }
  }

  const inserts = newProfiles.map((profile) => ({
    user_id: userId,
    linkedin_id: profile.id,
    linkedin_profile_url: profile.profileUrl,
    first_name: profile.firstName,
    last_name: profile.lastName,
    job_title: profile.headline,
    company: profile.company,
    industry: profile.industry,
    location: profile.location,
    profile_picture_url: profile.pictureUrl,
    connection_status: 'not_connected',
    source: 'ai_search',
  }))

  const { data: inserted, error } = await supabase
    .from('prospects')
    .upsert(inserts, { onConflict: 'user_id,linkedin_id', ignoreDuplicates: true })
    .select('id')

  if (error) {
    throw new Error(`linkedin.actions findAndCreateProspects DB error: ${error.message}`)
  }

  return { created: (inserted as { id: string }[] | null)?.length ?? 0 }
}

/**
 * Send a LinkedIn connection request via Unipile and update the prospect's
 * connection_status to 'pending' in the DB.
 */
export async function sendConnectionRequest(
  userId: string,
  prospectId: string,
  note: string,
): Promise<void> {
  const supabase = db()

  const { data: prospect, error: prospectError } = await supabase
    .from('prospects')
    .select('id, linkedin_id')
    .eq('id', prospectId)
    .eq('user_id', userId)
    .single()

  if (prospectError || !prospect) {
    throw new Error(
      `linkedin.actions sendConnectionRequest: prospect ${prospectId} not found`,
    )
  }

  const row = prospect as ProspectRow

  if (!row.linkedin_id) {
    throw new Error(
      `linkedin.actions sendConnectionRequest: prospect ${prospectId} has no linkedin_id`,
    )
  }

  const account = await getLinkedInAccount(userId)

  await unipileSendConnectionRequest(account.unipile_account_id, row.linkedin_id, note)

  const { error: updateError } = await supabase
    .from('prospects')
    .update({ connection_status: 'pending', updated_at: new Date().toISOString() })
    .eq('id', prospectId)

  if (updateError) {
    throw new Error(
      `linkedin.actions sendConnectionRequest: failed to update DB — ${updateError.message}`,
    )
  }
}

/**
 * Send a LinkedIn message via Unipile and persist a message record in the DB.
 */
export async function sendMessage(
  userId: string,
  prospectId: string,
  content: string,
): Promise<void> {
  const supabase = db()

  const { data: prospect, error: prospectError } = await supabase
    .from('prospects')
    .select('id, linkedin_id')
    .eq('id', prospectId)
    .eq('user_id', userId)
    .single()

  if (prospectError || !prospect) {
    throw new Error(`linkedin.actions sendMessage: prospect ${prospectId} not found`)
  }

  const row = prospect as ProspectRow

  if (!row.linkedin_id) {
    throw new Error(
      `linkedin.actions sendMessage: prospect ${prospectId} has no linkedin_id`,
    )
  }

  const account = await getLinkedInAccount(userId)

  // The thread ID in Unipile corresponds to the LinkedIn conversation thread.
  // We use the linkedin_id as the thread identifier (Unipile resolves this).
  await unipileSendLinkedInMessage(account.unipile_account_id, row.linkedin_id, content)

  const { error: insertError } = await supabase.from('messages').insert({
    user_id: userId,
    prospect_id: prospectId,
    direction: 'outbound',
    channel: 'linkedin',
    content,
    ai_generated: true,
    sent_at: new Date().toISOString(),
  })

  if (insertError) {
    throw new Error(
      `linkedin.actions sendMessage: failed to persist message — ${insertError.message}`,
    )
  }
}

/**
 * Pull inbound messages from Unipile for the given account, match them to
 * existing prospects, and create inbound message records in the DB.
 * Returns the count of newly synced messages.
 */
export async function syncInboundMessages(
  userId: string,
  accountId: string,
): Promise<{ synced: number }> {
  const supabase = db()

  // Determine the timestamp of the most recent inbound message we have
  const { data: latestMsg } = await supabase
    .from('messages')
    .select('sent_at')
    .eq('user_id', userId)
    .eq('direction', 'inbound')
    .order('sent_at', { ascending: false })
    .limit(1)
    .single()

  const since = latestMsg ? new Date((latestMsg as LatestMessageRow).sent_at) : undefined

  const rawMessages = await getAccountMessages(accountId, since)
  const inbound = rawMessages.filter((m) => m.isInbound)

  if (inbound.length === 0) {
    return { synced: 0 }
  }

  // Fetch all prospects for this user so we can match by linkedin_id
  const { data: prospects } = await supabase
    .from('prospects')
    .select('id, linkedin_id')
    .eq('user_id', userId)

  const prospectMap = new Map<string, string>()
  for (const p of (prospects as ProspectMapRow[] | null) ?? []) {
    if (p.linkedin_id !== null) {
      prospectMap.set(p.linkedin_id, p.id)
    }
  }

  let synced = 0

  for (const msg of inbound) {
    const prospectId = prospectMap.get(msg.senderId)
    if (!prospectId) {
      // Message from an unknown sender — skip
      continue
    }

    // Skip messages already recorded
    const { data: existing } = await supabase
      .from('messages')
      .select('id')
      .eq('unipile_message_id', msg.id)
      .maybeSingle()

    if (existing && (existing as MessageRow).id) {
      continue
    }

    const { error } = await supabase.from('messages').insert({
      user_id: userId,
      prospect_id: prospectId,
      direction: 'inbound',
      channel: 'linkedin',
      content: msg.content,
      unipile_message_id: msg.id,
      ai_generated: false,
      sent_at: msg.sentAt,
    })

    if (error) {
      // Log and continue rather than aborting the whole sync
      console.error(
        `linkedin.actions syncInboundMessages: failed to insert message ${msg.id} — ${error.message}`,
      )
      continue
    }

    synced++
  }

  return { synced }
}
