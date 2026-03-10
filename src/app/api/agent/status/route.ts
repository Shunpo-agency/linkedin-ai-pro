import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isBusinessHours, parisHour, LINKEDIN_DAILY_INVITE_LIMIT } from '@/lib/human-timing'
import { pingUnipile } from '@/core/linkedin/unipile.client'

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setUTCHours(0, 0, 0, 0)

    // ── Vérification credentials Unipile (silencieuse) ────────────────────────
    let unipileOk = true
    let unipileError: string | null = null
    try {
      await pingUnipile()
    } catch (err) {
      unipileOk = false
      unipileError = err instanceof Error ? err.message : 'Unipile unreachable'
    }

    // ── Checks en parallèle ───────────────────────────────────────────────────
    const [
      linkedinRes,
      settingsRes,
      recentRunsRes,
      todayProspectsRes,
      todayMessagesRes,
      todayErrorsRes,
    ] = await Promise.all([
      // LinkedIn connecté ?
      supabase
        .from('linkedin_accounts')
        .select('id, status, created_at')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle(),

      // Persona configuré ?
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from('business_settings')
        .select('target_persona, ai_behavior')
        .eq('user_id', user.id)
        .maybeSingle(),

      // 20 derniers runs
      supabase
        .from('agent_runs')
        .select('id, intent_type, status, started_at, completed_at, error')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(20),

      // Prospects découverts aujourd'hui
      supabase
        .from('prospects')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', todayStart.toISOString()),

      // Messages envoyés aujourd'hui
      supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('direction', 'outbound')
        .gte('created_at', todayStart.toISOString()),

      // Erreurs d'agent aujourd'hui
      supabase
        .from('agent_runs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'failed')
        .gte('started_at', todayStart.toISOString()),
    ])

    const recentRuns = recentRunsRes.data ?? []
    const lastRun = recentRuns[0] ?? null

    // Workers considérés actifs si un run dans les 4 dernières heures
    const workersActive = lastRun
      ? (now.getTime() - new Date(lastRun.started_at as string).getTime()) < 4 * 3600 * 1000
      : false

    const linkedinConnected = !!linkedinRes.data
    const personaConfigured = !!(settingsRes.data?.target_persona &&
      Array.isArray(settingsRes.data.target_persona?.roles) &&
      settingsRes.data.target_persona.roles.length > 0)

    // Checks de santé
    const checks = [
      {
        id: 'unipile',
        label: 'Clé API Unipile',
        status: unipileOk ? 'ok' : 'error',
        message: unipileOk
          ? 'Connexion Unipile opérationnelle'
          : `Clé API invalide ou expirée — ${unipileError ?? 'vérifie UNIPILE_API_KEY et UNIPILE_DSN dans Railway'}`,
        action: unipileOk ? null : 'https://app.unipile.com',
      },
      {
        id: 'linkedin',
        label: 'LinkedIn connecté',
        status: linkedinConnected ? 'ok' : 'error',
        message: linkedinConnected ? null : 'Connecte ton compte LinkedIn dans la page LinkedIn',
        action: linkedinConnected ? null : '/linkedin',
      },
      {
        id: 'persona',
        label: 'Persona cible configuré',
        status: personaConfigured ? 'ok' : 'warning',
        message: personaConfigured ? null : 'Configure les rôles et secteurs cibles ci-dessous',
        action: null,
      },
      {
        id: 'workers',
        label: 'Workers actifs',
        status: workersActive ? 'ok' : 'warning',
        message: workersActive
          ? `Dernier run : ${formatRelative(new Date(lastRun!.started_at as string))}`
          : lastRun
            ? `Dernier run : ${formatRelative(new Date(lastRun.started_at as string))} — redémarre le service Worker sur Railway`
            : 'Aucun run enregistré — le service Worker n\'est peut-être pas démarré sur Railway',
        action: null,
      },
      {
        id: 'hours',
        label: 'Heures ouvrées',
        status: isBusinessHours() ? 'ok' : 'info',
        message: isBusinessHours()
          ? `Il est ${parisHour()}h à Paris — l'agent peut agir`
          : `Il est ${parisHour()}h à Paris — l'agent reprend à 8h (lun-ven)`,
        action: null,
      },
    ]

    const todayStats = {
      prospectsFound: todayProspectsRes.count ?? 0,
      messagesSent: todayMessagesRes.count ?? 0,
      errors: todayErrorsRes.count ?? 0,
      inviteLimit: LINKEDIN_DAILY_INVITE_LIMIT,
      invitesRemaining: Math.max(0, LINKEDIN_DAILY_INVITE_LIMIT - (todayMessagesRes.count ?? 0)),
    }

    return NextResponse.json({
      isRunning: recentRuns.some((r) => r.status === 'running'),
      linkedinConnected,
      personaConfigured,
      workersActive,
      businessHours: isBusinessHours(),
      parisHour: parisHour(),
      checks,
      todayStats,
      recentRuns,
      lastRunAt: lastRun?.started_at ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message, code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'à l\'instant'
  if (diffMin < 60) return `il y a ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `il y a ${diffH}h`
  return `il y a ${Math.floor(diffH / 24)}j`
}
