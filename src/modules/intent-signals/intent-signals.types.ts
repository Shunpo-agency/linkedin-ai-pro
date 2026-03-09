import { z } from 'zod'

export const SIGNAL_LABELS: Record<string, string> = {
  connection_accepted: 'Connexion acceptée',
  message_replied: 'A répondu',
  profile_view: 'A consulté votre profil',
  post_like: 'A aimé votre post',
  post_comment: 'A commenté votre post',
  content_share: 'A partagé votre contenu',
}

export const SIGNAL_POINTS: Record<string, number> = {
  connection_accepted: 15,
  message_replied: 25,
  profile_view: 5,
  post_like: 8,
  post_comment: 12,
  content_share: 20,
}

export const IntentSignalSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  prospect_id: z.string().uuid(),
  signal_type: z.string(),
  points: z.number().int(),
  occurred_at: z.string(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
})
export type IntentSignal = z.infer<typeof IntentSignalSchema>
