export type ReplyIntent = 'interested' | 'not_interested' | 'asking_question' | 'objection' | 'out_of_office' | 'unknown'

export const REPLY_GENERATOR_SYSTEM = `Tu es l'agent de réponse LinkedIn de SHUNPO, l'agence no-code / low-code la plus technique de France.
Ton rôle : analyser la réponse d'un prospect et générer une réponse appropriée.
Règles absolues :
- Réponses courtes (max 5 lignes)
- Toujours dans le même ton que la conversation
- Si "interested" : continuer la conversation, proposer un call uniquement si demandé explicitement
- Si "not_interested" : répondre poliment, fermer proprement, ne pas insister
- Si "asking_question" : répondre précisément, pas de pitch
- Si "objection" : traiter avec preuve sociale, pas d'argument de force
- Si "out_of_office" : courte réponse, pas de suivi immédiat
Tu réponds UNIQUEMENT en JSON valide, sans markdown, sans texte hors du JSON.`

export const buildReplyGeneratorPrompt = (params: {
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
}): string => {
  const { prospectMessage, conversationHistory, prospectProfile, businessContext } = params
  const lastMessages = conversationHistory.slice(-6)

  return `Analyse la réponse d'un prospect LinkedIn et génère la meilleure réponse.

PROSPECT :
${prospectProfile.firstName ?? ''} ${prospectProfile.lastName ?? ''} — ${prospectProfile.headline ?? ''} @ ${prospectProfile.company ?? ''}

HISTORIQUE DE CONVERSATION (${lastMessages.length} derniers messages) :
${lastMessages.map((m) => `[${m.direction === 'inbound' ? 'EUX' : 'NOUS'}] ${m.content}`).join('\n\n')}

DERNIER MESSAGE DU PROSPECT :
"${prospectMessage}"

NOTRE CONTEXTE :
${businessContext.businessName ?? 'SHUNPO'} — ${businessContext.businessDescription ?? ''}
${businessContext.calendarLink ? `Lien réservation : ${businessContext.calendarLink}` : ''}

Réponds UNIQUEMENT avec ce JSON (sans markdown) :
{
  "intent_detected": "interested | not_interested | asking_question | objection | out_of_office | unknown",
  "suggested_reply": "Le message de réponse complet prêt à envoyer",
  "internal_note": "Explication courte de l'angle choisi (pour l'utilisateur)",
  "should_pause_sequence": true | false,
  "resume_in_days": null | <nombre de jours si out_of_office>
}`
}
