// ─────────────────────────────────────────────────────────────────────────────
// Anthropic Claude API wrapper — singleton client with typed helpers for every
// AI capability used by the agent.
// ─────────────────────────────────────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk'
import type { LeadScore, PersonaConfig, CampaignPerformanceData } from '@/core/agent/intents/types'
import { buildMessageGeneratorPrompt } from './prompts/message-generator.prompt'
import { buildLeadScorerPrompt, LEAD_SCORER_SYSTEM } from './prompts/lead-scorer.prompt'
import { buildPersonaRefinerPrompt } from './prompts/persona-refiner.prompt'
import { buildConversationReplyPrompt } from './prompts/conversation-reply.prompt'
import { buildProfileAnalyzerPrompt, PROFILE_ANALYZER_SYSTEM } from './prompts/profile-analyzer.prompt'
import { buildSequenceGeneratorPrompt, SEQUENCE_GENERATOR_SYSTEM } from './prompts/sequence-generator.prompt'
import { buildReplyGeneratorPrompt, REPLY_GENERATOR_SYSTEM } from './prompts/reply-generator.prompt'

// Alias for use in the new scoreLeadFull function (same underlying function)
const buildNewLeadScorerPrompt = buildLeadScorerPrompt

// ---------------------------------------------------------------------------
// Singleton client
// ---------------------------------------------------------------------------

let _client: Anthropic | null = null

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set')
    }
    _client = new Anthropic({ apiKey })
  }
  return _client
}

// ---------------------------------------------------------------------------
// Parameter interfaces
// ---------------------------------------------------------------------------

export interface MessageGenParams {
  businessDescription: string
  offers: unknown[]
  prospect: {
    firstName: string | null
    lastName: string | null
    jobTitle: string | null
    company: string | null
    industry: string | null
    location?: string | null
  }
  conversationHistory?: {
    direction: string
    content: string
  }[]
  /** Optional custom instructions for the opening message style (from ai_behavior.opener) */
  openerInstructions?: string
}

export interface ConversationReplyParams {
  businessDescription: string
  offers: unknown[]
  calendarLink: string | null
  prospect: {
    firstName: string | null
    lastName: string | null
    jobTitle: string | null
    company: string | null
    industry: string | null
    location?: string | null
  }
  /** Full conversation history (must include at least one inbound message) */
  conversationHistory: {
    direction: string
    content: string
  }[]
}

export interface ScoringParams {
  prospect: MessageGenParams['prospect']
  conversationHistory: MessageGenParams['conversationHistory']
  personaConfig: PersonaConfig
}

export interface RefineParams {
  currentPersona: PersonaConfig
  performanceData: CampaignPerformanceData
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Generate a personalized LinkedIn outreach message using claude-haiku-4-5.
 * Returns the raw message text ready to send.
 */
export async function generateLinkedInMessage(params: MessageGenParams): Promise<string> {
  const client = getClient()
  const { system, user } = buildMessageGeneratorPrompt(params)

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system,
    messages: [{ role: 'user', content: user }],
  })

  const block = response.content[0]
  if (!block || block.type !== 'text') {
    throw new Error('Claude generateLinkedInMessage: unexpected response format')
  }

  return block.text.trim()
}

/**
 * Generate a context-aware reply to an ongoing LinkedIn conversation using claude-haiku-4-5.
 * Handles objections, builds rapport, and guides toward booking a free call.
 * Returns the raw reply text ready to send.
 */
export async function generateConversationReply(params: ConversationReplyParams): Promise<string> {
  const client = getClient()
  const { system, user } = buildConversationReplyPrompt(params)

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system,
    messages: [{ role: 'user', content: user }],
  })

  const block = response.content[0]
  if (!block || block.type !== 'text') {
    throw new Error('Claude generateConversationReply: unexpected response format')
  }

  return block.text.trim()
}

/**
 * Score a prospect's likelihood to convert using claude-haiku-4-5.
 * Parses the JSON response into a LeadScore object.
 */
export async function scoreProspect(params: ScoringParams): Promise<LeadScore> {
  const client = getClient()
  const prompt = buildLeadScorerPrompt({
    profile: {
      firstName: params.prospect.firstName,
      lastName: params.prospect.lastName,
      headline: params.prospect.jobTitle,
      company: params.prospect.company,
      industry: params.prospect.industry,
      location: params.prospect.location,
    },
  })

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    system: LEAD_SCORER_SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  })

  const block = response.content[0]
  if (!block || block.type !== 'text') {
    throw new Error('Claude scoreProspect: unexpected response format')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(block.text.trim())
  } catch {
    throw new Error(
      `Claude scoreProspect: failed to parse JSON response — "${block.text.trim()}"`,
    )
  }

  const raw = parsed as Record<string, unknown>

  if (
    typeof raw.score !== 'number' ||
    typeof raw.temperature !== 'string' ||
    typeof raw.reasoning !== 'string'
  ) {
    throw new Error('Claude scoreProspect: response JSON has unexpected shape')
  }

  const temperature = raw.temperature as string
  if (temperature !== 'cold' && temperature !== 'warm' && temperature !== 'hot') {
    throw new Error(
      `Claude scoreProspect: invalid temperature value "${temperature}"`,
    )
  }

  return {
    score: raw.score,
    temperature,
    reasoning: raw.reasoning,
  }
}

/**
 * Suggest persona refinements based on campaign performance using claude-sonnet-4-6.
 * Returns a list of actionable suggestion strings and a confidence score.
 */
export async function refinePersonaSuggestions(
  params: RefineParams,
): Promise<{ suggestions: string[]; confidence: number }> {
  const client = getClient()
  const { system, user } = buildPersonaRefinerPrompt(params)

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    system,
    messages: [{ role: 'user', content: user }],
  })

  const block = response.content[0]
  if (!block || block.type !== 'text') {
    throw new Error('Claude refinePersonaSuggestions: unexpected response format')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(block.text.trim())
  } catch {
    throw new Error(
      `Claude refinePersonaSuggestions: failed to parse JSON response — "${block.text.trim()}"`,
    )
  }

  const raw = parsed as Record<string, unknown>

  if (!Array.isArray(raw.suggestions) || typeof raw.confidence !== 'number') {
    throw new Error('Claude refinePersonaSuggestions: response JSON has unexpected shape')
  }

  return {
    suggestions: raw.suggestions as string[],
    confidence: raw.confidence,
  }
}

// ---------------------------------------------------------------------------
// Feature 4: Profile Analyzer
// ---------------------------------------------------------------------------

export interface ProfileAnalysisResult {
  summary: string
  pain_points: string[]
  intent_signals: string[]
  tech_stack_detected: string[]
  shunpo_fit: 'fort' | 'moyen' | 'faible'
  recommended_angle: string
  personalization_hooks: string[]
  language: 'fr' | 'en'
}

export async function analyzeProfile(params: {
  profile: {
    firstName?: string | null
    lastName?: string | null
    headline?: string | null
    company?: string | null
    industry?: string | null
    location?: string | null
    summary?: string | null
  }
  recentPosts?: string[]
}): Promise<ProfileAnalysisResult> {
  const client = getClient()
  const prompt = buildProfileAnalyzerPrompt(params)

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: PROFILE_ANALYZER_SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  })

  const block = response.content[0]
  if (!block || block.type !== 'text') {
    throw new Error('Claude analyzeProfile: unexpected response format')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(block.text.trim())
  } catch {
    throw new Error(`Claude analyzeProfile: failed to parse JSON — "${block.text.trim()}"`)
  }

  return parsed as ProfileAnalysisResult
}

// ---------------------------------------------------------------------------
// Feature 1: Full Lead Scoring Engine
// ---------------------------------------------------------------------------

export interface FullLeadScore {
  score: number
  detail: {
    fit_icp: number
    intent_signals: number
    accessibility: number
    timing: number
  }
  signals_detected: string[]
  fit_icp_level: 'fort' | 'moyen' | 'faible'
  recommended_action: 'prioriser' | 'contacter' | 'surveiller' | 'ignorer'
  best_angle: string
  justification: string
}

export async function scoreLeadFull(params: {
  profile: {
    firstName?: string | null
    lastName?: string | null
    headline?: string | null
    company?: string | null
    industry?: string | null
    location?: string | null
    companySize?: string | null
  }
  profileAnalysis?: Record<string, unknown> | null
  targetPersona?: {
    roles?: string[]
    industries?: string[]
    companySizes?: string[]
    locations?: string[]
    keywords?: string[]
  } | null
}): Promise<FullLeadScore> {
  const client = getClient()
  const prompt = buildNewLeadScorerPrompt(params)

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system: LEAD_SCORER_SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  })

  const block = response.content[0]
  if (!block || block.type !== 'text') {
    throw new Error('Claude scoreLeadFull: unexpected response format')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(block.text.trim())
  } catch {
    throw new Error(`Claude scoreLeadFull: failed to parse JSON — "${block.text.trim()}"`)
  }

  const raw = parsed as Record<string, unknown>
  if (typeof raw.score !== 'number') {
    throw new Error('Claude scoreLeadFull: invalid JSON shape — missing score')
  }

  return raw as unknown as FullLeadScore
}

// ---------------------------------------------------------------------------
// Feature 2: Message Sequence Generator
// ---------------------------------------------------------------------------

export interface SequenceStep {
  content: string
  day_offset: number
}

export interface GeneratedSequence {
  step_1: SequenceStep
  step_2: SequenceStep
  step_3: SequenceStep
  step_4: SequenceStep
}

export async function generateMessageSequence(params: {
  profile: {
    firstName?: string | null
    lastName?: string | null
    headline?: string | null
    company?: string | null
    industry?: string | null
  }
  profileAnalysis?: Record<string, unknown> | null
  scoreDetail?: Record<string, unknown> | null
  businessContext: {
    businessName?: string | null
    businessDescription?: string | null
    offers?: Array<{ title: string; description: string }> | null
  }
  tone?: string
  calendarLink?: string | null
}): Promise<GeneratedSequence> {
  const client = getClient()
  const prompt = buildSequenceGeneratorPrompt(params)

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    system: SEQUENCE_GENERATOR_SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  })

  const block = response.content[0]
  if (!block || block.type !== 'text') {
    throw new Error('Claude generateMessageSequence: unexpected response format')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(block.text.trim())
  } catch {
    throw new Error(`Claude generateMessageSequence: failed to parse JSON — "${block.text.trim()}"`)
  }

  const raw = parsed as Record<string, unknown>
  if (!raw.step_1 || !raw.step_2 || !raw.step_3 || !raw.step_4) {
    throw new Error('Claude generateMessageSequence: invalid JSON shape — missing steps')
  }

  return raw as unknown as GeneratedSequence
}

// ---------------------------------------------------------------------------
// Feature 3: Reply Generator (enhanced)
// ---------------------------------------------------------------------------

export interface SuggestedReplyResult {
  intent_detected: string
  suggested_reply: string
  internal_note: string
  should_pause_sequence: boolean
  resume_in_days: number | null
}

export async function generateSuggestedReply(params: {
  prospectMessage: string
  conversationHistory: Array<{ direction: 'inbound' | 'outbound'; content: string }>
  prospectProfile: {
    firstName?: string | null
    lastName?: string | null
    headline?: string | null
    company?: string | null
  }
  businessContext: {
    businessName?: string | null
    businessDescription?: string | null
    calendarLink?: string | null
  }
}): Promise<SuggestedReplyResult> {
  const client = getClient()
  const prompt = buildReplyGeneratorPrompt(params)

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    system: REPLY_GENERATOR_SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  })

  const block = response.content[0]
  if (!block || block.type !== 'text') {
    throw new Error('Claude generateSuggestedReply: unexpected response format')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(block.text.trim())
  } catch {
    throw new Error(`Claude generateSuggestedReply: failed to parse JSON — "${block.text.trim()}"`)
  }

  return parsed as SuggestedReplyResult
}
