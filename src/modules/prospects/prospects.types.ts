import { z } from 'zod'

export const ProspectSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  linkedin_profile_url: z.string().url(),
  linkedin_id: z.string().nullable(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  job_title: z.string().nullable(),
  company: z.string().nullable(),
  industry: z.string().nullable(),
  location: z.string().nullable(),
  profile_picture_url: z.string().nullable(),
  connection_status: z.enum(['not_connected', 'pending', 'connected']),
  lead_score: z.number().int().min(0).max(100),
  temperature: z.enum(['cold', 'warm', 'hot']),
  booking_status: z.enum(['none', 'link_sent', 'booked']),
  calendar_event_url: z.string().nullable(),
  ai_notes: z.string().nullable(),
  source: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type Prospect = z.infer<typeof ProspectSchema>

export const CreateProspectSchema = ProspectSchema.omit({
  id: true,
  user_id: true,
  created_at: true,
  updated_at: true,
})
export type CreateProspect = z.infer<typeof CreateProspectSchema>

export const UpdateProspectSchema = CreateProspectSchema.partial()
export type UpdateProspect = z.infer<typeof UpdateProspectSchema>

export const ProspectFiltersSchema = z.object({
  temperature: z.enum(['cold', 'warm', 'hot']).optional(),
  booking_status: z.enum(['none', 'link_sent', 'booked']).optional(),
  connection_status: z.enum(['not_connected', 'pending', 'connected']).optional(),
  industry: z.string().optional(),
  search: z.string().optional(),
})
export type ProspectFilters = z.infer<typeof ProspectFiltersSchema>
