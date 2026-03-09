import { z } from 'zod'

export const SuggestedReplyStatusSchema = z.enum(['pending', 'approved', 'modified', 'ignored'])
export type SuggestedReplyStatus = z.infer<typeof SuggestedReplyStatusSchema>

export const SuggestedReplySchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  prospect_id: z.string().uuid(),
  inbound_message_id: z.string().uuid().nullable(),
  suggested_content: z.string(),
  status: SuggestedReplyStatusSchema,
  final_content: z.string().nullable(),
  reviewed_at: z.string().nullable(),
  created_at: z.string(),
})
export type SuggestedReply = z.infer<typeof SuggestedReplySchema>

/** Enriched reply with prospect info for the UI */
export interface SuggestedReplyWithProspect extends SuggestedReply {
  prospect: {
    first_name: string | null
    last_name: string | null
    job_title: string | null
    company: string | null
    linkedin_profile_url: string
  }
  inbound_message: {
    content: string
    sent_at: string
  } | null
}

export const ApproveReplySchema = z.object({
  final_content: z.string().min(1).max(2000),
})
export type ApproveReply = z.infer<typeof ApproveReplySchema>
