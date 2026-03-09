export const SEQUENCE_GENERATOR_SYSTEM = `Tu es l'agent de prospection LinkedIn de SHUNPO, l'agence no-code / low-code la plus technique de France.
Clients de référence : TF1, Altaroc, lemlist, Carte Noire.
Stack : Bubble, WeWeb, Webflow, Xano, Supabase, n8n, Make, Next.js.
ICP cible : Startups Series A-C, Scale-ups, ETI avec équipe produit.

Règles absolues pour les messages :
- Jamais de pitch avant le message 2
- Maximum 5 lignes par message
- Toujours ancrer sur un élément concret du profil ou de l'actualité du prospect
- Une seule CTA par message
- Ton : expert, direct, pas de formules creuses
- Langue : français par défaut, anglais si profil anglophone détecté
Tu réponds UNIQUEMENT en JSON valide, sans markdown, sans texte hors du JSON.`

export const buildSequenceGeneratorPrompt = (params: {
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
}): string => {
  const { profile, profileAnalysis, businessContext, tone = 'professional', calendarLink } = params

  return `Génère une séquence de 4 messages LinkedIn personnalisés pour ce prospect.

PROSPECT :
Nom : ${profile.firstName ?? 'Prénom'} ${profile.lastName ?? ''}
Titre : ${profile.headline ?? 'Inconnu'}
Entreprise : ${profile.company ?? 'Inconnue'}
Secteur : ${profile.industry ?? 'Inconnu'}

${profileAnalysis ? `ANALYSE IA :
Angle recommandé : ${(profileAnalysis.recommended_angle as string) ?? ''}
Pain points : ${JSON.stringify(profileAnalysis.pain_points ?? [])}
Hooks de personnalisation : ${JSON.stringify(profileAnalysis.personalization_hooks ?? [])}
Langue détectée : ${(profileAnalysis.language as string) ?? 'fr'}` : ''}

NOTRE ENTREPRISE :
${businessContext.businessName ?? 'SHUNPO'} — ${businessContext.businessDescription ?? 'Agence no-code/low-code'}
Offres : ${(businessContext.offers ?? []).map((o) => o.title).join(', ')}

Ton : ${tone}
${calendarLink ? `Lien de réservation : ${calendarLink}` : ''}

SÉQUENCE À GÉNÉRER :
- step_1 (J0) : Note de connexion ou message si déjà connecté. Court, personnalisé, zéro pitch. Max 3 lignes.
- step_2 (J2) : Accroche personnalisée, zéro pitch, ancré sur un fait concret. Max 4 lignes.
- step_3 (J5) : Apport de valeur (insight, ressource, cas client pertinent). Max 5 lignes.
- step_4 (J10) : Message de "breakup" honnête et direct. Max 3 lignes.

Réponds UNIQUEMENT avec ce JSON (sans markdown) :
{
  "step_1": { "content": "...", "day_offset": 0 },
  "step_2": { "content": "...", "day_offset": 2 },
  "step_3": { "content": "...", "day_offset": 5 },
  "step_4": { "content": "...", "day_offset": 10 }
}`
}
