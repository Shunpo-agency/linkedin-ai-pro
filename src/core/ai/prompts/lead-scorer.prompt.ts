export const LEAD_SCORER_SYSTEM = `Tu es l'agent de scoring de SHUNPO, l'agence no-code / low-code la plus technique de France.
ICP cible : Startups Series A-C, Scale-ups, ETI avec équipe produit.
Postes prioritaires : CTO, CPO, CEO, Head of Product, DSI.
Tu évalues chaque lead sur 100 points selon 4 critères.
Tu réponds UNIQUEMENT en JSON valide, sans markdown, sans texte hors du JSON.`

export const buildLeadScorerPrompt = (params: {
  profile: {
    firstName?: string | null
    lastName?: string | null
    headline?: string | null
    company?: string | null
    industry?: string | null
    location?: string | null
    companySize?: string | null
  }
  profileAnalysis?: Record<string, unknown> | null
  targetPersona?: {
    roles?: string[]
    industries?: string[]
    companySizes?: string[]
    locations?: string[]
    keywords?: string[]
  } | null
}): string => {
  const { profile, profileAnalysis, targetPersona } = params

  return `Score ce lead LinkedIn pour SHUNPO (agence no-code/low-code) sur 100 points.

PROFIL DU LEAD :
Nom : ${profile.firstName ?? ''} ${profile.lastName ?? ''}
Titre : ${profile.headline ?? 'Inconnu'}
Entreprise : ${profile.company ?? 'Inconnue'}
Secteur : ${profile.industry ?? 'Inconnu'}
Taille entreprise : ${profile.companySize ?? 'Inconnue'}
Localisation : ${profile.location ?? 'Inconnue'}

${profileAnalysis ? `ANALYSE PROFIL :
Fit SHUNPO : ${(profileAnalysis.shunpo_fit as string) ?? 'inconnu'}
Signaux d'intention : ${JSON.stringify(profileAnalysis.intent_signals ?? [])}
Pain points : ${JSON.stringify(profileAnalysis.pain_points ?? [])}` : ''}

${targetPersona ? `PERSONA CIBLE DE LA CAMPAGNE :
Postes : ${(targetPersona.roles ?? []).join(', ')}
Secteurs : ${(targetPersona.industries ?? []).join(', ')}
Tailles : ${(targetPersona.companySizes ?? []).join(', ')}
Localisations : ${(targetPersona.locations ?? []).join(', ')}` : ''}

CRITÈRES DE SCORING (total 100 pts) :
- fit_icp (0-30) : Adéquation poste/secteur/taille avec l'ICP SHUNPO
- intent_signals (0-30) : Signaux d'intention détectés (job change récent, recrutement actif, post sur pain points no-code, levée de fonds, nouveau CTO/CPO/DSI, mention concurrent, croissance rapide)
- accessibility (0-20) : Profil ouvert, actif sur LinkedIn, connexions communes potentielles
- timing (0-20) : Job change <90j, recrutement actif, levée récente, expansion équipe

SIGNAUX D'INTENTION À DÉTECTER :
- job_change_recent : Changement de poste dans les 90 derniers jours
- active_recruiting_tech : Offres d'emploi tech actives
- post_pain_point_nocode : Post mentionnant no-code/low-code/automatisation
- fundraising_recent : Levée de fonds récente (Series A/B/C)
- new_cto_cpo_dsi : Nouveau CTO/CPO/DSI nommé récemment
- competitor_mention : Mention d'un concurrent ou outil no-code
- rapid_growth : Croissance rapide de l'équipe LinkedIn

Réponds UNIQUEMENT avec ce JSON (sans markdown) :
{
  "score": <0-100>,
  "detail": {
    "fit_icp": <0-30>,
    "intent_signals": <0-30>,
    "accessibility": <0-20>,
    "timing": <0-20>
  },
  "signals_detected": ["signal_key1", "signal_key2"],
  "fit_icp_level": "fort | moyen | faible",
  "recommended_action": "prioriser | contacter | surveiller | ignorer",
  "best_angle": "L'angle d'approche le plus pertinent en 1 phrase",
  "justification": "Explication courte du score en 2-3 phrases"
}`
}
