// ─────────────────────────────────────────────────────────────────────────────
// Campaign Setup Prompt — AI-powered LinkedIn targeting from business description
// ─────────────────────────────────────────────────────────────────────────────

export const CAMPAIGN_SETUP_SYSTEM = `Tu es LinkedIn AI Pro, expert en prospection LinkedIn B2B.
Ton rôle : analyser une description d'entreprise (ou le contenu de son site web) et définir la stratégie de ciblage LinkedIn la plus pertinente.

Tu dois identifier :
- Quels profils LinkedIn sont les acheteurs/décideurs les plus susceptibles d'avoir besoin de cette offre
- Dans quels secteurs, tailles d'entreprise, localisations ils se trouvent
- Les mots-clés qui caractérisent ces profils

Réponds UNIQUEMENT en JSON valide, sans markdown.`

export interface CampaignSetupResult {
  campaign_name: string
  roles: string[]
  industries: string[]
  company_sizes: string[]
  locations: string[]
  keywords: string[]
  tone: 'professional' | 'casual' | 'persuasive'
  daily_invite_limit: number
  message_angle: string
  rationale: string
}

export function buildCampaignSetupPrompt({
  description,
  websiteContent,
  url,
}: {
  description?: string
  websiteContent?: string
  url?: string
}): string {
  const context = [
    url && `URL du site : ${url}`,
    websiteContent && `Contenu du site :\n${websiteContent.slice(0, 3000)}`,
    description && `Description fournie :\n${description}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  return `Analyse cette entreprise et génère la stratégie de ciblage LinkedIn optimale.

${context}

Retourne un JSON avec exactement cette structure :
{
  "campaign_name": "Nom court et accrocheur pour la campagne (ex: Prospection DRH PME France)",
  "roles": ["Rôle 1", "Rôle 2", "Rôle 3", "Rôle 4", "Rôle 5"],
  "industries": ["Secteur 1", "Secteur 2", "Secteur 3"],
  "company_sizes": ["10-50", "50-200"],
  "locations": ["France", "Belgique"],
  "keywords": ["mot-clé 1", "mot-clé 2", "mot-clé 3"],
  "tone": "professional",
  "daily_invite_limit": 15,
  "message_angle": "En 1-2 phrases : l'angle d'accroche principal pour les messages",
  "rationale": "En 2-3 phrases : pourquoi ce ciblage est le bon pour cette offre"
}

Règles :
- roles : 3-6 titres de poste en français (ex: "Directeur Marketing", "CMO", "Responsable Digital")
- industries : 2-4 secteurs pertinents
- company_sizes : utilise ces valeurs exactes : "1-10", "10-50", "50-200", "200-1000", "1000+"
- locations : pays ou régions francophones si pas précisé
- tone : "professional" par défaut, "casual" si cible startup/jeune, "persuasive" si cible décideur C-level
- daily_invite_limit : entre 10 et 20`
}
