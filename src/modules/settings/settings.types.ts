import { z } from 'zod'

export const OfferSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string(),
  price: z.string().optional(),
})
export type Offer = z.infer<typeof OfferSchema>

export const PersonaConfigSchema = z.object({
  roles: z.array(z.string()),
  industries: z.array(z.string()),
  companySizes: z.array(z.string()),
  locations: z.array(z.string()),
  keywords: z.array(z.string()),
})
export type PersonaConfig = z.infer<typeof PersonaConfigSchema>

export const AiBehaviorSchema = z.object({
  tone: z.string().default('professional'),
  followUpDelayDays: z.number().int().min(1).max(30).default(3),
  dailyMessageLimit: z.number().int().min(1).max(200).default(20),
  opener: z.string().default(''),
  fullAuto: z.boolean().default(false),
})
export type AiBehavior = z.infer<typeof AiBehaviorSchema>

export const BusinessSettingsSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  business_name: z.string().nullable(),
  business_description: z.string().nullable(),
  offers: z.array(OfferSchema),
  main_features: z.array(z.string()),
  business_model: z.string().nullable(),
  target_persona: PersonaConfigSchema.nullable(),
  ai_behavior: AiBehaviorSchema.optional(),
  calendar_link: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type BusinessSettings = z.infer<typeof BusinessSettingsSchema>

export const UpdateSettingsSchema = BusinessSettingsSchema.omit({
  id: true,
  user_id: true,
  created_at: true,
  updated_at: true,
}).partial()
export type UpdateSettings = z.infer<typeof UpdateSettingsSchema>
