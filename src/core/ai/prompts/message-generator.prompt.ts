import type { MessageGenParams } from '../claude.client'

// Detect if the prospect is likely French-speaking based on location
function isFrenchLocation(location?: string | null): boolean {
  if (!location) return false
  const loc = location.toLowerCase()
  return loc.includes('france') || loc.includes('français') || loc.includes('francaise')
}

export function buildMessageGeneratorPrompt(params: MessageGenParams): {
  system: string
  user: string
} {
  const isFrench = isFrenchLocation(params.prospect.location)

  const languageRule = isFrench
    ? `\n11. LANGUE : Ce prospect est en France. Tu DOIS écrire le message EN FRANÇAIS. Utilise "vous" par défaut (tutoiement uniquement si l'industrie est très décontractée comme la tech startup). Respecte toutes les autres règles mais en français.`
    : ''

  const system = `You are ghostwriting a LinkedIn outreach message for a founder or consultant. Your job is to write messages that feel genuinely human — like a smart, curious person reached out, not like a sales bot.

STRICT RULES:
1. NEVER open with "I". Start with the prospect, an observation, or a hook about their world.
2. Zero buzzwords. Not "synergy", "leverage", "game-changer", "disruptive", "innovative", "scalable", "touch base", "circle back", "value-add", "ROI", "ecosystem".
3. Keep it SHORT:
   - Connection request note → max 280 characters (hard limit, LinkedIn enforces this)
   - Follow-up message → max 400 characters
4. NO subject line, NO greeting prefix ("Hi [Name],"), NO signature, NO emojis. Just the raw message body.
5. End with ONE simple, genuine question. Not "Would you be open to a quick call?" — that's spam. Ask something specific to their role or situation.
6. Sound like a curious peer, not a salesperson. The goal is a reply, not a sale.
7. Reference something specific about their role, company, or industry. Make it feel written for them.
8. Seniority tone:
   - C-suite, founders, VPs → direct, peer-level, no hand-holding
   - Mid-level managers → collaborative, "we're figuring this out together" energy
9. Industry awareness:
   - Tech / B2B SaaS → extra crisp, zero fluff. These people get 50+ spam DMs a week.
   - Traditional industries → slightly warmer, more context is OK
10. Output the message body ONLY. Nothing else. No preamble, no explanation.${languageRule}`

  const isFollowUp =
    params.conversationHistory !== undefined && params.conversationHistory.length > 0

  const openerNote = params.openerInstructions
    ? `\nInstructions from the sender: ${params.openerInstructions}`
    : ''

  const contextBlock = isFollowUp
    ? `Context: This is a follow-up message. Here is the conversation so far:\n${params.conversationHistory!
        .map((m) => `[${m.direction === 'outbound' ? 'Me' : 'Them'}]: ${m.content}`)
        .join('\n')}`
    : `Context: This is the very first message — it will be the connection request note. Max 280 characters.`

  const offersList = params.offers
    .map((o: unknown) => {
      const offer = o as { title?: string; description?: string }
      return offer.title ?? String(o)
    })
    .join(', ')

  const user = `Write a LinkedIn outreach message. Human. Brief. No fluff.

Prospect:
- Name: ${params.prospect.firstName ?? ''} ${params.prospect.lastName ?? ''}
- Role: ${params.prospect.jobTitle ?? 'unknown'}
- Company: ${params.prospect.company ?? 'unknown'}
- Industry: ${params.prospect.industry ?? 'unknown'}
- Location: ${params.prospect.location ?? 'unknown'}

My business: ${params.businessDescription}
What I offer: ${offersList}
${openerNote}
${contextBlock}

Write the message body only.`

  return { system, user }
}
