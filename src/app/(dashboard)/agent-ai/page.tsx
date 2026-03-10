'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { useT } from '@/lib/i18n/context'
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Play,
  RefreshCw,
  Linkedin,
  Bot,
  Activity,
  Clock,
  Zap,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface HealthCheck {
  id: string
  label: string
  status: 'ok' | 'warning' | 'error' | 'info'
  message: string | null
  action: string | null
}

interface AgentRun {
  id: string
  intent_type: string
  status: string
  started_at: string
  completed_at: string | null
  error: string | null
}

interface AgentStatus {
  isRunning: boolean
  linkedinConnected: boolean
  personaConfigured: boolean
  workersActive: boolean
  businessHours: boolean
  parisHour: number
  checks: HealthCheck[]
  todayStats: {
    prospectsFound: number
    messagesSent: number
    errors: number
    inviteLimit: number
    invitesRemaining: number
  }
  recentRuns: AgentRun[]
  lastRunAt: string | null
}

// ── Form schema ───────────────────────────────────────────────────────────────

const AgentFormSchema = z.object({
  target_roles: z.string().optional(),
  target_industries: z.string().optional(),
  target_company_sizes: z.string().optional(),
  target_locations: z.string().optional(),
  target_keywords: z.string().optional(),
  ai_tone: z.string().optional(),
  ai_follow_up_delay: z.number().int().min(1).max(30).optional(),
  ai_daily_limit: z.number().int().min(1).max(200).optional(),
  calendar_link: z.string().optional(),
  ai_opener: z.string().optional(),
  full_auto: z.boolean().optional(),
})
type AgentForm = z.infer<typeof AgentFormSchema>

// ── Helpers ───────────────────────────────────────────────────────────────────

function CheckIcon({ status }: { status: HealthCheck['status'] }) {
  if (status === 'ok') return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
  if (status === 'error') return <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
  if (status === 'warning') return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
  return <Info className="h-4 w-4 text-blue-400 shrink-0" />
}

function statusBg(status: HealthCheck['status']) {
  if (status === 'ok') return 'bg-green-50 border-green-200'
  if (status === 'error') return 'bg-red-50 border-red-200'
  if (status === 'warning') return 'bg-amber-50 border-amber-200'
  return 'bg-blue-50 border-blue-200'
}

function runStatusBadge(status: string) {
  const base = 'text-xs px-2 py-0.5 rounded-full font-medium'
  if (status === 'success') return <span className={`${base} bg-green-100 text-green-700`}>✓ succès</span>
  if (status === 'failed') return <span className={`${base} bg-red-100 text-red-700`}>✗ erreur</span>
  if (status === 'running') return <span className={`${base} bg-blue-100 text-blue-700 animate-pulse`}>⟳ en cours</span>
  return <span className={`${base} bg-slate-100 text-slate-600`}>{status}</span>
}

function intentLabel(intent: string) {
  const map: Record<string, string> = {
    FIND_PROSPECTS: '🔍 Recherche prospects',
    SEND_CONNECTION_REQUEST: '🤝 Demande connexion',
    SEND_MESSAGE: '✉️ Envoi message',
    FOLLOW_UP: '↩️ Relance',
    SCORE_LEAD: '⭐ Scoring lead',
    REFINE_PERSONA: '🎯 Affinage persona',
    BOOK_MEETING: '📅 Prise de RDV',
  }
  return map[intent] ?? intent
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AgentAIPage() {
  const t = useT()
  const { toast } = useToast()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [status, setStatus] = useState<AgentStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)

  // ── Load status ────────────────────────────────────────────────────────────
  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/status')
      if (res.ok) setStatus(await res.json())
    } catch { /* ignore */ }
    finally { setStatusLoading(false) }
  }, [])

  useEffect(() => {
    loadStatus()
    const id = setInterval(loadStatus, 30_000)
    return () => clearInterval(id)
  }, [loadStatus])

  // ── Manual trigger ─────────────────────────────────────────────────────────
  async function handleTrigger() {
    setTriggering(true)
    try {
      const res = await fetch('/api/agent/trigger', { method: 'POST' })
      if (res.ok) {
        toast({ title: '🚀 Découverte lancée', description: 'L\'agent va chercher des prospects maintenant.' })
        setTimeout(loadStatus, 3000)
      } else {
        const data = await res.json()
        toast({ title: 'Erreur', description: data.error ?? 'Impossible de déclencher', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Erreur réseau', variant: 'destructive' })
    } finally {
      setTriggering(false)
    }
  }

  // ── Settings form ─────────────────────────────────────────────────────────
  const form = useForm<AgentForm>({
    resolver: zodResolver(AgentFormSchema),
    defaultValues: {
      target_roles: '', target_industries: '', target_company_sizes: '',
      target_locations: '', target_keywords: '', ai_tone: 'professional',
      ai_follow_up_delay: 3, ai_daily_limit: 20, calendar_link: '',
      ai_opener: '', full_auto: false,
    },
  })

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then((data) => {
      if (!data || data.error) return
      form.reset({
        target_roles: data.target_persona?.roles?.join(', ') ?? '',
        target_industries: data.target_persona?.industries?.join(', ') ?? '',
        target_company_sizes: data.target_persona?.companySizes?.join(', ') ?? '',
        target_locations: data.target_persona?.locations?.join(', ') ?? '',
        target_keywords: data.target_persona?.keywords?.join(', ') ?? '',
        ai_tone: data.ai_behavior?.tone ?? 'professional',
        ai_follow_up_delay: data.ai_behavior?.followUpDelayDays ?? 3,
        ai_daily_limit: data.ai_behavior?.dailyMessageLimit ?? 20,
        calendar_link: data.calendar_link ?? '',
        ai_opener: data.ai_behavior?.opener ?? '',
        full_auto: data.ai_behavior?.fullAuto ?? false,
      })
    }).catch(() => {})
  }, [form])

  const splitCsv = (val?: string) =>
    (val ?? '').split(',').map((s) => s.trim()).filter(Boolean)

  const saveSettings = useCallback(async (values: AgentForm): Promise<void> => {
    try {
      const body = {
        target_persona: {
          roles: splitCsv(values.target_roles),
          industries: splitCsv(values.target_industries),
          companySizes: splitCsv(values.target_company_sizes),
          locations: splitCsv(values.target_locations),
          keywords: splitCsv(values.target_keywords),
        },
        ai_behavior: {
          tone: values.ai_tone ?? 'professional',
          followUpDelayDays: values.ai_follow_up_delay ?? 3,
          dailyMessageLimit: values.ai_daily_limit ?? 20,
          opener: values.ai_opener ?? '',
          fullAuto: values.full_auto ?? false,
        },
        calendar_link: values.calendar_link || null,
      }
      const res = await fetch('/api/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) toast({ title: t('common.saveFailed'), variant: 'destructive' })
    } catch {
      toast({ title: t('common.networkError'), variant: 'destructive' })
    }
  }, [toast, t])

  useEffect(() => {
    const sub = form.watch(() => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        form.handleSubmit(saveSettings)(new Event('submit') as unknown as React.BaseSyntheticEvent)
      }, 800)
    })
    return () => { sub.unsubscribe(); if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [form, saveSettings])

  const fullAuto = form.watch('full_auto')

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Bot className="h-6 w-6 text-blue-500" />
            {t('agentAi.title')}
          </h1>
          <p className="text-slate-500 text-sm mt-1">{t('agentAi.subtitle')}</p>
        </div>
        <Button
          onClick={handleTrigger}
          disabled={triggering || !status?.linkedinConnected}
          className="gap-2"
        >
          {triggering
            ? <><RefreshCw className="h-4 w-4 animate-spin" /> Lancement…</>
            : <><Play className="h-4 w-4" /> Lancer maintenant</>}
        </Button>
      </div>

      {/* ── Health checks ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" /> Santé de l&apos;agent
            </CardTitle>
            <button onClick={loadStatus} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
              <RefreshCw className="h-3 w-3" /> Actualiser
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {statusLoading ? (
            <div className="text-sm text-slate-400">Chargement…</div>
          ) : !status ? (
            <div className="text-sm text-red-500">Impossible de charger le statut</div>
          ) : (
            <>
              {status.checks.map((check) => (
                <div
                  key={check.id}
                  className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${statusBg(check.status)}`}
                >
                  <CheckIcon status={check.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{check.label}</p>
                    {check.message && (
                      <p className="text-xs text-slate-500 mt-0.5">{check.message}</p>
                    )}
                  </div>
                  {check.action && (
                    <Link href={check.action} className="text-xs text-blue-600 underline shrink-0">
                      Configurer →
                    </Link>
                  )}
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Stats du jour ─────────────────────────────────────────────────── */}
      {status && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Prospects trouvés', value: status.todayStats.prospectsFound, icon: '🔍', color: 'text-blue-600' },
            { label: 'Messages envoyés', value: status.todayStats.messagesSent, icon: '✉️', color: 'text-green-600' },
            {
              label: 'Invitations restantes',
              value: `${status.todayStats.invitesRemaining}/${status.todayStats.inviteLimit}`,
              icon: '🤝', color: 'text-purple-600',
            },
            { label: 'Erreurs', value: status.todayStats.errors, icon: '⚠️', color: status.todayStats.errors > 0 ? 'text-red-600' : 'text-slate-400' },
          ].map((stat) => (
            <Card key={stat.label} className="text-center py-3">
              <div className="text-lg">{stat.icon}</div>
              <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Log des derniers runs ──────────────────────────────────────────── */}
      {status && status.recentRuns.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" /> Activité récente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {status.recentRuns.slice(0, 10).map((run) => (
                <div key={run.id} className="flex items-center gap-3 py-1.5 border-b border-slate-100 last:border-0">
                  <span className="text-xs text-slate-400 w-12 shrink-0">{formatTime(run.started_at)}</span>
                  <span className="text-sm flex-1">{intentLabel(run.intent_type)}</span>
                  {runStatusBadge(run.status)}
                  {run.error && (
                    <span className="text-xs text-red-500 truncate max-w-[180px]" title={run.error}>
                      {run.error}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Règles anti-détection LinkedIn ────────────────────────────────── */}
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 text-amber-800">
            <Linkedin className="h-4 w-4" /> Protection anti-détection LinkedIn
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-amber-700 space-y-1">
          <p>🕐 Actif uniquement lun-ven, 8h-19h heure de Paris</p>
          <p>📊 Maximum <strong>15 invitations / jour</strong> (limite safe LinkedIn)</p>
          <p>⏱️ Délai <strong>4-12 minutes aléatoires</strong> entre chaque invitation</p>
          <p>🎲 Démarrage aléatoire dans une fenêtre de ±25 min pour éviter les patterns</p>
          <p>🍽️ Activité réduite pendant la pause déjeuner (12h-14h)</p>
        </CardContent>
      </Card>

      {/* ── Configuration ─────────────────────────────────────────────────── */}
      <form>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              {t('agentAi.targetPersona')}
            </CardTitle>
            <CardDescription>{t('agentAi.targetPersonaDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('agentAi.targetRoles')}</Label>
                <Input {...form.register('target_roles')} placeholder="CTO, VP Engineering, Head of Product" />
              </div>
              <div className="space-y-2">
                <Label>{t('agentAi.industries')}</Label>
                <Input {...form.register('target_industries')} placeholder="SaaS, Fintech, Healthcare" />
              </div>
              <div className="space-y-2">
                <Label>{t('agentAi.companySizes')}</Label>
                <Input {...form.register('target_company_sizes')} placeholder="1-50, 51-200, 201-500" />
              </div>
              <div className="space-y-2">
                <Label>{t('agentAi.locations')}</Label>
                <Input {...form.register('target_locations')} placeholder="France, Belgique, Suisse" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('agentAi.keywords')}</Label>
              <Input {...form.register('target_keywords')} placeholder="automation, no-code, growth, IA" />
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('agentAi.aiBehaviour')}</CardTitle>
            <CardDescription>{t('agentAi.aiBehaviourDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t('agentAi.tone')}</Label>
                <Input {...form.register('ai_tone')} placeholder="professional, casual, direct" />
              </div>
              <div className="space-y-2">
                <Label>{t('agentAi.followUpDelay')}</Label>
                <Input {...form.register('ai_follow_up_delay', { valueAsNumber: true })} type="number" min={1} max={30} />
              </div>
              <div className="space-y-2">
                <Label>{t('agentAi.dailyLimit')}</Label>
                <Input {...form.register('ai_daily_limit', { valueAsNumber: true })} type="number" min={1} max={15} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('agentAi.openerInstructions')}</Label>
              <Textarea
                {...form.register('ai_opener')}
                placeholder="Ex: Toujours mentionner un changement de poste récent. Max 200 chars. Ne pas pitcher directement."
                rows={3}
              />
            </div>

            <div className="flex items-start gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex-1 space-y-0.5">
                <p className="text-sm font-medium text-slate-800">{t('agentAi.fullAutoTitle')}</p>
                <p className="text-xs text-slate-500">{t('agentAi.fullAutoDesc')}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={fullAuto}
                onClick={() => form.setValue('full_auto', !fullAuto, { shouldDirty: true })}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${fullAuto ? 'bg-blue-600' : 'bg-slate-200'}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${fullAuto ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('agentAi.bookingLink')}</CardTitle>
            <CardDescription>{t('agentAi.bookingLinkDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Input {...form.register('calendar_link')} placeholder="https://calendly.com/yourname/30min" type="url" />
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
