// ─────────────────────────────────────────────────────────────────────────────
// Human Timing — Anti-détection LinkedIn
//
// Règles de sécurité LinkedIn :
//  • Max 15 invitations / jour (limite safe, LinkedIn banni à ~100/semaine)
//  • Heures ouvrées uniquement : lun-ven 8h-19h heure de Paris
//  • Pause déjeuner réduite : 12h-14h (50% moins d'activité)
//  • Délai minimum entre chaque invitation : 4 min
//  • Délai maximum : 12 min (avec variance aléatoire)
//  • Démarrage aléatoire dans une fenêtre de ±20 min
// ─────────────────────────────────────────────────────────────────────────────

export const LINKEDIN_DAILY_INVITE_LIMIT = 15

/** Retourne un entier aléatoire entre min et max (inclus) */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/** Retourne un délai en ms aléatoire dans l'intervalle */
export function randomDelayMs(minMs: number, maxMs: number): number {
  return randomInt(minMs, maxMs)
}

/** Détecte si on est en heure d'été en France (dernier dim. mars → dernier dim. octobre) */
function isFrenchDST(date: Date): boolean {
  const month = date.getUTCMonth() + 1 // 1-12
  if (month > 3 && month < 10) return true
  if (month < 3 || month > 10) return false
  // Mars ou octobre : approximation safe
  return month === 3 ? date.getUTCDate() >= 25 : date.getUTCDate() < 25
}

/** Heure locale Paris (0-23) pour une date UTC */
export function parisHour(date: Date = new Date()): number {
  const offset = isFrenchDST(date) ? 2 : 1
  return (date.getUTCHours() + offset + 24) % 24
}

/** Jour de la semaine en heure Paris (0=dim, 1=lun, …, 6=sam) */
export function parisDayOfWeek(date: Date = new Date()): number {
  const offset = isFrenchDST(date) ? 2 : 1
  const parisMidnight = new Date(date.getTime() + offset * 3600 * 1000)
  return parisMidnight.getUTCDay()
}

/**
 * L'agent peut-il agir maintenant ?
 * Lun-ven, 8h-19h heure de Paris.
 * Pendant la pause déjeuner (12h-14h), on ralentit mais on ne s'arrête pas.
 */
export function isBusinessHours(date: Date = new Date()): boolean {
  const dow = parisDayOfWeek(date)
  if (dow === 0 || dow === 6) return false // week-end
  const h = parisHour(date)
  return h >= 8 && h < 19
}

/** Est-ce la pause déjeuner (12h-14h Paris) ? */
export function isLunchBreak(date: Date = new Date()): boolean {
  const h = parisHour(date)
  return h >= 12 && h < 14
}

/**
 * Retourne un délai (en ms) pour la prochaine invitation LinkedIn.
 * - Normal : 4-12 minutes aléatoires
 * - Pause déjeuner : 8-20 minutes (moins d'activité)
 */
export function nextInviteDelayMs(date: Date = new Date()): number {
  if (isLunchBreak(date)) {
    return randomDelayMs(8 * 60_000, 20 * 60_000)
  }
  return randomDelayMs(4 * 60_000, 12 * 60_000)
}

/**
 * Calcule les délais en ms pour N invitations étalées sur le reste de la journée.
 * Les délais respectent la limite de 15/jour et les heures ouvrées.
 */
export function spreadInvitesAcrossDay(count: number, date: Date = new Date()): number[] {
  const safeCount = Math.min(count, LINKEDIN_DAILY_INVITE_LIMIT)
  if (safeCount === 0) return []

  const h = parisHour(date)
  const m = date.getUTCMinutes()
  const currentMinuteOfDay = h * 60 + m
  const endOfDay = 19 * 60 // 19h Paris

  const remainingMinutes = Math.max(30, endOfDay - currentMinuteOfDay)
  const intervalMs = (remainingMinutes * 60_000) / (safeCount + 1)

  return Array.from({ length: safeCount }, (_, i) => {
    const base = intervalMs * (i + 1)
    const variance = base * 0.25 // ±25% de variance
    return Math.max(4 * 60_000, base + randomDelayMs(-variance, variance))
  })
}

/**
 * Délai de démarrage aléatoire (0-25 min) pour éviter les patterns réguliers.
 * À utiliser au début de chaque job de découverte.
 */
export function startupJitterMs(): number {
  return randomDelayMs(0, 25 * 60_000)
}

/** Formate un délai en ms en chaîne lisible (ex: "8 min 32 s") */
export function formatDelay(ms: number): string {
  const totalSec = Math.round(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (min === 0) return `${sec}s`
  return sec > 0 ? `${min} min ${sec}s` : `${min} min`
}
