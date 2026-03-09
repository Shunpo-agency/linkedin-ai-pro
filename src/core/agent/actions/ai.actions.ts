// ─────────────────────────────────────────────────────────────────────────────
// AI actions — wraps Claude client calls with Supabase DB context.
// Fetches all required data, calls AI, and persists results.
//
// Note: The project's Database type is missing the PostgrestVersion key required
// by supabase-js v2.98+, causing table types to resolve to `never`.
// We use a `db()` helper that casts the client to `any` for DB operations —
// the same workaround used across this codebase.
// ─────────────────────────────────────────────────────────────────────────────

import { createServiceClient } from '@/lib/supabase/service'
import { generateLinkedInMessage, generateConversationReply, scoreProspect } from '@/core/ai/claude.client'
import type { LeadScore, PersonaConfig } from '@/core/agent/intents/types'
import type { MessageGenParams, ScoringParams, ConversationReplyParams } from '@/core/ai/claude.client'

// ---------------------------------------------------------------------------
// DB row shapes — mirrors database.types but used locally for safe casting
// ---------------------------------------------------------------------------

interface ProspectRow {
  id: string
  first_name: string | null
  last_name: string | null
  job_title: string | null
  company: string | null
  industry: string | null
  location: string | null
}

interface BusinessSettingsRow {
  business_description: string | null
  offers: unknown
  target_persona: unknown
  calendar_link: string | null
  ai_behavior: unknown
}

interface MessageRow {
  direction: string
  content: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any {
  return createServiceClient() as unknown
}

async function fetchProspect(userId: string, prospectId: string): Promise<ProspectRow> {
  const supabase = db()

  const { data, error } = await supabase
    .from('prospects')
    .select('id, first_name, last_name, job_title, company, industry, location')
    .eq('id', prospectId)
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    throw new Error(`ai.actions: prospect ${prospectId} not found for user ${userId}`)
  }

  return data as ProspectRow
}

async function fetchBusinessSettings(userId: string): Promise<BusinessSettingsRow> {
  const supabase = db()

  const { data, error } = await supabase
    .from('business_settings')
    .select('business_description, offers, target_persona, calendar_link, ai_behavior')
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    throw new Error(`ai.actions: business settings not found for user ${userId}`)
  }

  return data as BusinessSettingsRow
}

async function fetchConversationHistory(
  userId: string,
  prospectId: string,
): Promise<{ direction: string; content: string }[]> {
  const supabase = db()

  const { data, error } = await supabase
    .from('messages')
    .select('direction, content, sent_at')
    .eq('user_id', userId)
    .eq('prospect_id', prospectId)
    .order('sent_at', { ascending: true })

  if (error) {
    throw new Error(
      `ai.actions: failed to fetch messages for prospect ${prospectId} — ${error.message}`,
    )
  }

  return ((data as MessageRow[]) ?? []).map((m) => ({
    direction: m.direction,
    content: m.content,
  }))
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/**
 * Fetch all required context for a prospect, generate a personalized LinkedIn
 * message via Claude, and return the generated content.
 */
export async function generateAndQueueMessage(
  userId: string,
  prospectId: string,
): Promise<string> {
  const [prospect, settings, conversationHistory] = await Promise.all([
    fetchProspect(userId, prospectId),
    fetchBusinessSettings(userId),
    fetchConversationHistory(userId, prospectId),
  ])

  const offersRaw = Array.isArray(settings.offers) ? (settings.offers as unknown[]) : []

  // Extract opener instructions from ai_behavior jsonb
  const aiBehavior =
    settings.ai_behavior !== null &&
    typeof settings.ai_behavior === 'object' &&
    !Array.isArray(settings.ai_behavior)
      ? (settings.ai_behavior as Record<string, unknown>)
      : null

  const params: MessageGenParams = {
    businessDescription: settings.business_description ?? '',
    offers: offersRaw,
    prospect: {
      firstName: prospect.first_name,
      lastName: prospect.last_name,
      jobTitle: prospect.job_title,
      company: prospect.company,
      industry: prospect.industry,
      location: prospect.location,
    },
    conversationHistory: conversationHistory.length > 0 ? conversationHistory : undefined,
    openerInstructions:
      typeof aiBehavior?.opener === 'string' && aiBehavior.opener
        ? aiBehavior.opener
        : undefined,
  }

  const content = await generateLinkedInMessage(params)
  return content
}

/**
 * Fetch prospect data, conversation history, and persona config from the DB,
 * score the lead via Claude, persist the score on the prospect record, and
 * return the LeadScore.
 */
export async function scoreProspectLead(
  userId: string,
  prospectId: string,
): Promise<LeadScore> {
  const supabase = db()

  const [prospect, settings, conversationHistory] = await Promise.all([
    fetchProspect(userId, prospectId),
    fetchBusinessSettings(userId),
    fetchConversationHistory(userId, prospectId),
  ])

  // target_persona is stored as Json in the DB; cast safely
  const rawPersona =
    settings.target_persona !== null &&
    typeof settings.target_persona === 'object' &&
    !Array.isArray(settings.target_persona)
      ? (settings.target_persona as Record<string, unknown>)
      : null

  const personaConfig: PersonaConfig = {
    roles: Array.isArray(rawPersona?.roles) ? (rawPersona!.roles as string[]) : [],
    industries: Array.isArray(rawPersona?.industries)
      ? (rawPersona!.industries as string[])
      : [],
    companySizes: Array.isArray(rawPersona?.companySizes)
      ? (rawPersona!.companySizes as string[])
      : [],
    locations: Array.isArray(rawPersona?.locations)
      ? (rawPersona!.locations as string[])
      : [],
    keywords: Array.isArray(rawPersona?.keywords)
      ? (rawPersona!.keywords as string[])
      : [],
  }

  const params: ScoringParams = {
    prospect: {
      firstName: prospect.first_name,
      lastName: prospect.last_name,
      jobTitle: prospect.job_title,
      company: prospect.company,
      industry: prospect.industry,
    },
    conversationHistory: conversationHistory.length > 0 ? conversationHistory : undefined,
    personaConfig,
  }

  const leadScore = await scoreProspect(params)

  const { error: updateError } = await supabase
    .from('prospects')
    .update({
      lead_score: leadScore.score,
      temperature: leadScore.temperature,
      updated_at: new Date().toISOString(),
    })
    .eq('id', prospectId)
    .eq('user_id', userId)

  if (updateError) {
    throw new Error(
      `ai.actions scoreProspectLead: failed to persist score — ${updateError.message}`,
    )
  }

  return leadScore
}

/**
 * Generate a smart conversational reply for an inbound LinkedIn message.
 * Fetches full conversation history and business context, then calls Claude to
 * produce a human-sounding reply that handles objections and moves toward booking.
 * Returns the raw reply text (caller is responsible for sending/queuing).
 */
export async function generateAndSendReply(
  userId: string,
  prospectId: string,
): Promise<string> {
  const [prospect, settings, conversationHistory] = await Promise.all([
    fetchProspect(userId, prospectId),
    fetchBusinessSettings(userId),
    fetchConversationHistory(userId, prospectId),
  ])

  if (conversationHistory.length === 0) {
    throw new Error(
      `ai.actions generateAndSendReply: no conversation history found for prospect ${prospectId}`,
    )
  }

  const offersRaw = Array.isArray(settings.offers) ? (settings.offers as unknown[]) : []

  const params: ConversationReplyParams = {
    businessDescription: settings.business_description ?? '',
    offers: offersRaw,
    calendarLink:
      typeof settings.calendar_link === 'string' && settings.calendar_link
        ? settings.calendar_link
        : null,
    prospect: {
      firstName: prospect.first_name,
      lastName: prospect.last_name,
      jobTitle: prospect.job_title,
      company: prospect.company,
      industry: prospect.industry,
      location: prospect.location,
    },
    conversationHistory,
  }

  const content = await generateConversationReply(params)
  return content
}
