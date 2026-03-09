import { z } from 'zod'

export const MessageSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  prospect_id: z.string().uuid(),
  direction: z.enum(['outbound', 'inbound']),
  channel: z.enum(['linkedin', 'email']),
  content: z.string(),
  unipile_message_id: z.string().nullable(),
  sent_at: z.string(),
  read_at: z.string().nullable(),
  ai_generated: z.boolean(),
})
export type Message = z.infer<typeof MessageSchema>

export const CreateMessageSchema = MessageSchema.omit({
  id: true,
  user_id: true,
})
export type CreateMessage = z.infer<typeof CreateMessageSchema>
