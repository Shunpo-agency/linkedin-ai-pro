import { z } from 'zod'

// ── Campaign type ─────────────────────────────────────────────────────────────

export const CampaignTypeSchema = z.enum(['prospect_discovery', 'outreach'])
export type CampaignType = z.infer<typeof CampaignTypeSchema>

// ── Discovery persona (who to search for on LinkedIn) ────────────────────────

export const DiscoveryPersonaSchema = z.object({
  roles: z.array(z.string()),          // e.g. ["DRH", "Directeur RH", "Head of HR"]
  industries: z.array(z.string()),     // e.g. ["BTP", "Tech"]
  companySizes: z.array(z.string()),   // e.g. ["50-200", "200-1000"]
  locations: z.array(z.string()),      // e.g. ["France", "Île-de-France"]
  keywords: z.array(z.string()),       // e.g. ["recrutement", "croissance"]
})
export type DiscoveryPersona = z.infer<typeof DiscoveryPersonaSchema>

// ── Audience filters (which existing prospects to target for outreach) ────────

export const AudienceFiltersSchema = z.object({
  temperatures: z.array(z.enum(['cold', 'warm', 'hot'])).default([]),
  connectionStatuses: z.array(z.enum(['not_connected', 'pending', 'connected'])).default([]),
})
export type AudienceFilters = z.infer<typeof AudienceFiltersSchema>

// ── Per-campaign AI behavior ──────────────────────────────────────────────────

export const CampaignAiBehaviorSchema = z.object({
  tone: z.enum(['professional', 'casual', 'persuasive']).default('professional'),
  followUpDelayDays: z.number().int().min(1).max(30).default(3),
  customInstructions: z.string().max(500).optional(),
})
export type CampaignAiBehavior = z.infer<typeof CampaignAiBehaviorSchema>

// ── Full campaign ─────────────────────────────────────────────────────────────

export const CampaignSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string().min(1),
  type: CampaignTypeSchema.default('outreach'),
  status: z.enum(['active', 'paused', 'completed']),
  persona_snapshot: z.record(z.string(), z.unknown()).nullable(),
  audience_filters: z.record(z.string(), z.unknown()).nullable().optional(),
  daily_invite_limit: z.number().int().min(1).max(100).default(15),
  ai_behavior: z.record(z.string(), z.unknown()).nullable().optional(),
  prospects_count: z.number().int(),
  messages_sent: z.number().int(),
  replies_count: z.number().int(),
  meetings_booked: z.number().int(),
  started_at: z.string(),
  ended_at: z.string().nullable(),
})
export type Campaign = z.infer<typeof CampaignSchema>

export const CreateCampaignSchema = z.object({
  name: z.string().min(1),
  type: CampaignTypeSchema.default('outreach'),
  status: z.enum(['active', 'paused', 'completed']).default('paused'),
  persona_snapshot: z.record(z.string(), z.unknown()).nullable().optional(),
  audience_filters: z.record(z.string(), z.unknown()).nullable().optional(),
  daily_invite_limit: z.number().int().min(1).max(100).default(15),
  ai_behavior: z.record(z.string(), z.unknown()).nullable().optional(),
})
export type CreateCampaign = z.infer<typeof CreateCampaignSchema>

export const UpdateCampaignSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(['active', 'paused', 'completed']).optional(),
  persona_snapshot: z.record(z.string(), z.unknown()).nullable().optional(),
  audience_filters: z.record(z.string(), z.unknown()).nullable().optional(),
  daily_invite_limit: z.number().int().min(1).max(100).optional(),
  ai_behavior: z.record(z.string(), z.unknown()).nullable().optional(),
})
export type UpdateCampaign = z.infer<typeof UpdateCampaignSchema>

// ── Agent run (for activity log) ─────────────────────────────────────────────

export interface AgentRun {
  id: string
  campaign_id: string | null
  intent_type: string
  status: string
  result: Record<string, unknown> | null
  error: string | null
  started_at: string
  completed_at: string | null
}
