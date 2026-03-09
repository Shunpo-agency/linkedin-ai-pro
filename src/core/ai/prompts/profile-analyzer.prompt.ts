export const PROFILE_ANALYZER_SYSTEM = `Tu es l'agent de prospection LinkedIn de SHUNPO, l'agence no-code / low-code la plus technique de France.
Clients de référence : TF1, Altaroc, lemlist, Carte Noire.
Stack : Bubble, WeWeb, Webflow, Xano, Supabase, n8n, Make, Next.js.
ICP cible : Startups Series A-C, Scale-ups, ETI avec équipe produit.
Postes : CTO, CPO, CEO, Head of Product, DSI.

Ton style : expert, direct, crédible. Jamais de flatterie ni de formules creuses.
Tu réponds UNIQUEMENT en JSON valide, sans markdown, sans texte hors du JSON.`

export const buildProfileAnalyzerPrompt = (params: {
  profile: {
    firstName?: string | null
    lastName?: string | null
    headline?: string | null
    company?: string | null
    industry?: string | null
    location?: string | null
    summary?: string | null
  }
  recentPosts?: string[]
}): string => {
  const { profile, recentPosts = [] } = params

  return `Analyse ce profil LinkedIn et retourne une fiche prospect enrichie en JSON.

PROFIL :
Nom : ${profile.firstName ?? ''} ${profile.lastName ?? ''}
Titre : ${profile.headline ?? 'Inconnu'}
Entreprise : ${profile.company ?? 'Inconnue'}
Secteur : ${profile.industry ?? 'Inconnu'}
Localisation : ${profile.location ?? 'Inconnue'}
Résumé : ${profile.summary ?? 'Aucun'}

${recentPosts.length > 0 ? `POSTS RÉCENTS (${recentPosts.length}) :\n${recentPosts.map((p, i) => `Post ${i + 1}: ${p.substring(0, 300)}`).join('\n\n')}` : ''}

Réponds UNIQUEMENT avec ce JSON (sans markdown) :
{
  "summary": "Résumé en 2 phrases de ce profil et de son rôle",
  "pain_points": ["pain point 1", "pain point 2"],
  "intent_signals": ["signal détecté 1", "signal détecté 2"],
  "tech_stack_detected": ["outil/tech mentionné"],
  "shunpo_fit": "fort | moyen | faible",
  "recommended_angle": "L'angle d'accroche le plus pertinent pour SHUNPO",
  "personalization_hooks": ["élément concret du profil à utiliser dans le message"],
  "language": "fr | en"
}`
}
