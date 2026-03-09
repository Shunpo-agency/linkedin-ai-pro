'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Loader2,
  ExternalLink,
  Bot,
  SendHorizonal,
  Star,
  Calendar,
  Zap,
  ListOrdered,
  Play,
  PauseCircle,
  SkipForward,
  CheckCircle2,
  Clock,
  XCircle,
  TrendingUp,
  Target,
  Timer,
  Activity,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { timeAgo } from '@/shared/utils/date'
import { initials, fullName } from '@/shared/utils/formatting'
import { useT } from '@/lib/i18n/context'
import { SIGNAL_LABELS } from '@/modules/intent-signals/intent-signals.types'
import type { IntentSignal } from '@/modules/intent-signals/intent-signals.types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ScoreBreakdown {
  score: number
  detail: {
    fit_icp: number
    intent_signals: number
    accessibility: number
    timing: number
  }
  signals_detected: string[]
  fit_icp_level: string
  recommended_action: string
  best_angle: string
  justification: string
}

interface Prospect {
  id: string
  first_name: string | null
  last_name: string | null
  job_title: string | null
  company: string | null
  industry: string | null
  location: string | null
  linkedin_profile_url: string
  connection_status: string
  lead_score: number
  temperature: string
  booking_status: string
  ai_notes: string | null
  score_breakdown: ScoreBreakdown | null
  score_updated_at: string | null
  profile_analysis: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

interface Message {
  id: string
  direction: 'inbound' | 'outbound'
  content: string
  sent_at: string
  ai_generated: boolean
}

interface SequenceStep {
  id: string
  step: number
  content: string
  status: 'pending' | 'sent' | 'replied' | 'paused' | 'skipped'
  scheduled_at: string
  sent_at: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TEMP_COLORS: Record<string, string> = {
  cold: 'bg-blue-100 text-blue-700',
  warm: 'bg-orange-100 text-orange-700',
  hot: 'bg-red-100 text-red-700',
}

const SIGNAL_COLORS: Record<string, string> = {
  connection_accepted: 'bg-green-100 text-green-700',
  message_replied: 'bg-blue-100 text-blue-700',
  profile_view: 'bg-slate-100 text-slate-600',
  post_like: 'bg-pink-100 text-pink-700',
  post_comment: 'bg-purple-100 text-purple-700',
  content_share: 'bg-orange-100 text-orange-700',
}

const STEP_LABELS: Record<number, string> = {
  1: 'Connexion (J0)',
  2: 'Message Hook (J+2)',
  3: 'Message Valeur (J+5)',
  4: 'Breakup (J+10)',
}

const STEP_STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'En attente', color: 'bg-slate-100 text-slate-600', icon: <Clock className="h-3 w-3" /> },
  sent: { label: 'Envoyé', color: 'bg-blue-100 text-blue-700', icon: <CheckCircle2 className="h-3 w-3" /> },
  replied: { label: 'Répondu', color: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="h-3 w-3" /> },
  paused: { label: 'En pause', color: 'bg-yellow-100 text-yellow-700', icon: <PauseCircle className="h-3 w-3" /> },
  skipped: { label: 'Ignoré', color: 'bg-red-100 text-red-600', icon: <XCircle className="h-3 w-3" /> },
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  prioriser: { label: 'Prioriser', color: 'bg-green-100 text-green-700' },
  contacter: { label: 'Contacter', color: 'bg-blue-100 text-blue-700' },
  surveiller: { label: 'Surveiller', color: 'bg-yellow-100 text-yellow-700' },
  ignorer: { label: 'Ignorer', color: 'bg-red-100 text-red-600' },
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProspectDetailPage() {
  const t = useT()
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [prospect, setProspect] = useState<Prospect | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [signals, setSignals] = useState<IntentSignal[]>([])
  const [intentScore, setIntentScore] = useState(0)
  const [sequence, setSequence] = useState<SequenceStep[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [scoring, setScoring] = useState(false)
  const [generatingSeq, setGeneratingSeq] = useState(false)
  const [showScoreDetail, setShowScoreDetail] = useState(false)
  const [showProfileAnalysis, setShowProfileAnalysis] = useState(false)
  const [scoreQueued, setScoreQueued] = useState(false)
  const [seqQueued, setSeqQueued] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const [pRes, mRes, sRes, seqRes] = await Promise.all([
        fetch(`/api/prospects/${id}`),
        fetch(`/api/messages?prospect_id=${id}`),
        fetch(`/api/intent-signals/${id}`),
        fetch(`/api/sequences?prospect_id=${id}`),
      ])
      const [pData, mData, sData, seqData] = await Promise.all([
        pRes.json(), mRes.json(), sRes.json(), seqRes.json(),
      ])
      setProspect(pData)
      setMessages(Array.isArray(mData) ? mData : [])
      setSignals(Array.isArray(sData?.signals) ? sData.signals : [])
      setIntentScore(typeof sData?.totalScore === 'number' ? sData.totalScore : 0)
      setSequence(Array.isArray(seqData) ? seqData : [])
    } catch {
      // handle silently
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleSend(): Promise<void> {
    if (!message.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospect_id: id, content: message }),
      })
      const newMsg = await res.json()
      if (!newMsg.error) {
        setMessages((prev) => [...prev, newMsg])
        setMessage('')
      }
    } finally {
      setSending(false)
    }
  }

  async function handleGenerateMessage(): Promise<void> {
    setScoring(true)
    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'SEND_MESSAGE', payload: { prospectId: id, channel: 'linkedin' } }),
      })
      const data = await res.json()
      if (data.generatedContent) setMessage(data.generatedContent)
    } finally {
      setScoring(false)
    }
  }

  async function handleScoreLead(): Promise<void> {
    setScoring(true)
    setScoreQueued(false)
    try {
      const res = await fetch(`/api/prospects/${id}/score`, { method: 'POST' })
      const data = await res.json()
      if (data.jobId) {
        setScoreQueued(true)
        // Poll for updated score data after worker completes (~8s)
        setTimeout(async () => {
          const scoreRes = await fetch(`/api/prospects/${id}/score`)
          const scoreData = await scoreRes.json()
          if (scoreData.lead_score !== undefined) {
            setProspect((p) => p ? {
              ...p,
              lead_score: scoreData.lead_score,
              temperature: scoreData.temperature ?? p.temperature,
              score_breakdown: scoreData.score_breakdown ?? null,
              score_updated_at: scoreData.score_updated_at ?? null,
              profile_analysis: scoreData.profile_analysis ?? null,
              ai_notes: scoreData.ai_notes ?? null,
            } : p)
          }
          setScoreQueued(false)
        }, 8000)
      }
    } finally {
      setScoring(false)
    }
  }

  async function handleBookMeeting(): Promise<void> {
    setSending(true)
    try {
      await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'BOOK_MEETING', payload: { prospectId: id } }),
      })
      if (prospect) setProspect({ ...prospect, booking_status: 'link_sent' })
    } finally {
      setSending(false)
    }
  }

  async function handleGenerateSequence(): Promise<void> {
    setGeneratingSeq(true)
    setSeqQueued(false)
    try {
      const res = await fetch('/api/sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospect_id: id }),
      })
      const data = await res.json()
      if (data.jobId) {
        setSeqQueued(true)
        // Poll after generation delay
        setTimeout(async () => {
          const seqRes = await fetch(`/api/sequences?prospect_id=${id}`)
          const seqData = await seqRes.json()
          if (Array.isArray(seqData)) setSequence(seqData)
          setSeqQueued(false)
        }, 15000)
      }
    } finally {
      setGeneratingSeq(false)
    }
  }

  async function handleStepAction(stepId: string, status: 'paused' | 'skipped'): Promise<void> {
    try {
      await fetch(`/api/sequences/${stepId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      setSequence((prev) => prev.map((s) => s.id === stepId ? { ...s, status } : s))
    } catch {
      // handle silently
    }
  }

  // ── Computed ───────────────────────────────────────────────────────────────

  const sb = prospect?.score_breakdown
  const pa = prospect?.profile_analysis as Record<string, unknown> | null
  const pendingSteps = sequence.filter((s) => s.status === 'pending').length
  const hasSequence = sequence.length > 0

  // ── Loading / not found ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  if (!prospect) {
    return (
      <div className="text-center py-24 text-slate-500">
        <p>{t('prospects.notFound')}</p>
        <Button variant="link" onClick={() => router.push('/prospects')}>
          {t('prospects.backToProspects')}
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl space-y-6">
      <button
        onClick={() => router.push('/prospects')}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" /> {t('prospects.backToProspects')}
      </button>

      <div className="grid grid-cols-3 gap-6">
        {/* ── Left column ──────────────────────────────────────────────────── */}
        <div className="col-span-1 space-y-4">

          {/* Profile card */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex flex-col items-center text-center gap-3">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-blue-100 text-blue-700 text-xl font-semibold">
                    {initials(prospect.first_name, prospect.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="font-semibold text-lg">
                    {fullName(prospect.first_name, prospect.last_name)}
                  </h2>
                  <p className="text-sm text-slate-500">{prospect.job_title ?? '—'}</p>
                  <p className="text-sm text-slate-500">{prospect.company ?? '—'}</p>
                </div>
                <Badge className={TEMP_COLORS[prospect.temperature] ?? ''} variant="secondary">
                  {prospect.temperature}
                </Badge>
              </div>

              <Separator />

              <div className="space-y-2 text-sm">
                {prospect.industry && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('prospects.industry')}</span>
                    <span className="font-medium">{prospect.industry}</span>
                  </div>
                )}
                {prospect.location && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('prospects.location')}</span>
                    <span className="font-medium">{prospect.location}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('prospects.connection')}</span>
                  <Badge variant="outline" className="capitalize text-xs">
                    {prospect.connection_status.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('prospects.booking')}</span>
                  <Badge variant="outline" className="capitalize text-xs">
                    {prospect.booking_status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>

              <Separator />

              {/* Lead score */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{t('prospects.leadScore')}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{prospect.lead_score}/100</span>
                    {prospect.score_updated_at && (
                      <span className="text-xs text-slate-400">{timeAgo(prospect.score_updated_at)}</span>
                    )}
                  </div>
                </div>
                <Progress value={prospect.lead_score} className="h-2" />
              </div>

              <Separator />

              {/* Actions */}
              <div className="space-y-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={handleScoreLead}
                  disabled={scoring || scoreQueued}
                >
                  <Star className="h-3.5 w-3.5 mr-1.5" />
                  {scoring ? 'En cours…' : scoreQueued ? 'Score en cours…' : t('prospects.scoreLead')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={handleBookMeeting}
                  disabled={sending || prospect.booking_status === 'booked'}
                >
                  <Calendar className="h-3.5 w-3.5 mr-1.5" />
                  {prospect.booking_status === 'link_sent' ? t('prospects.linkSent') : t('prospects.bookMeeting')}
                </Button>
                <a
                  href={prospect.linkedin_profile_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full"
                >
                  <Button size="sm" variant="outline" className="w-full">
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    {t('prospects.viewProfile')}
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Score breakdown card */}
          {sb && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-purple-500" />
                    Détail du score
                  </CardTitle>
                  <button
                    className="text-slate-400 hover:text-slate-600"
                    onClick={() => setShowScoreDetail((v) => !v)}
                  >
                    {showScoreDetail ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* 4 dimension bars */}
                <div className="space-y-2.5">
                  <ScoreBar
                    label="ICP Fit"
                    icon={<Target className="h-3 w-3 text-blue-500" />}
                    value={sb.detail.fit_icp}
                    max={30}
                    color="bg-blue-500"
                  />
                  <ScoreBar
                    label="Signaux d&apos;intention"
                    icon={<Zap className="h-3 w-3 text-yellow-500" />}
                    value={sb.detail.intent_signals}
                    max={30}
                    color="bg-yellow-500"
                  />
                  <ScoreBar
                    label="Accessibilité"
                    icon={<Activity className="h-3 w-3 text-green-500" />}
                    value={sb.detail.accessibility}
                    max={20}
                    color="bg-green-500"
                  />
                  <ScoreBar
                    label="Timing"
                    icon={<Timer className="h-3 w-3 text-orange-500" />}
                    value={sb.detail.timing}
                    max={20}
                    color="bg-orange-500"
                  />
                </div>

                {/* Recommended action */}
                {sb.recommended_action && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Action recommandée</span>
                    <Badge
                      variant="secondary"
                      className={`text-xs ${ACTION_LABELS[sb.recommended_action]?.color ?? 'bg-slate-100 text-slate-600'}`}
                    >
                      {ACTION_LABELS[sb.recommended_action]?.label ?? sb.recommended_action}
                    </Badge>
                  </div>
                )}

                {showScoreDetail && (
                  <>
                    {/* Signals detected */}
                    {Array.isArray(sb.signals_detected) && sb.signals_detected.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-slate-500 font-medium">Signaux détectés</p>
                        <div className="flex flex-wrap gap-1">
                          {sb.signals_detected.map((sig, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{sig}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Best angle */}
                    {sb.best_angle && (
                      <div className="space-y-1">
                        <p className="text-xs text-slate-500 font-medium">Meilleur angle</p>
                        <p className="text-xs text-slate-700">{sb.best_angle}</p>
                      </div>
                    )}

                    {/* Justification */}
                    {sb.justification && (
                      <div className="space-y-1">
                        <p className="text-xs text-slate-500 font-medium">Justification</p>
                        <p className="text-xs text-slate-600 leading-relaxed">{sb.justification}</p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Profile analysis card */}
          {pa && Object.keys(pa).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Bot className="h-4 w-4 text-indigo-500" />
                    Analyse du profil
                  </CardTitle>
                  <button
                    className="text-slate-400 hover:text-slate-600"
                    onClick={() => setShowProfileAnalysis((v) => !v)}
                  >
                    {showProfileAnalysis ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </CardHeader>
              {showProfileAnalysis && (
                <CardContent className="space-y-3 text-xs">
                  {typeof pa.summary === 'string' && (
                    <p className="text-slate-600 leading-relaxed">{pa.summary}</p>
                  )}
                  {Array.isArray(pa.pain_points) && pa.pain_points.length > 0 && (
                    <div>
                      <p className="text-slate-500 font-medium mb-1">Points de douleur</p>
                      <ul className="space-y-0.5 list-disc list-inside text-slate-600">
                        {(pa.pain_points as string[]).map((point, i) => <li key={i}>{point}</li>)}
                      </ul>
                    </div>
                  )}
                  {typeof pa.recommended_angle === 'string' && (
                    <div>
                      <p className="text-slate-500 font-medium mb-1">Angle recommandé</p>
                      <p className="text-slate-600">{pa.recommended_angle}</p>
                    </div>
                  )}
                  {Array.isArray(pa.personalization_hooks) && pa.personalization_hooks.length > 0 && (
                    <div>
                      <p className="text-slate-500 font-medium mb-1">Hooks de personnalisation</p>
                      <div className="flex flex-wrap gap-1">
                        {(pa.personalization_hooks as string[]).map((h, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{h}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          )}

          {/* AI Notes */}
          {prospect.ai_notes && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Bot className="h-4 w-4 text-blue-500" />
                  {t('prospects.aiNotes')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600">{prospect.ai_notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Intent signals */}
          {signals.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between gap-1.5">
                  <span className="flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    {t('prospects.intentSignals')}
                  </span>
                  <Badge variant="secondary" className="text-xs">+{intentScore} pts</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {signals.slice(0, 6).map((signal) => (
                  <div key={signal.id} className="flex items-center justify-between gap-2 text-xs">
                    <Badge
                      variant="secondary"
                      className={`text-xs ${SIGNAL_COLORS[signal.signal_type] ?? ''}`}
                    >
                      {SIGNAL_LABELS[signal.signal_type] ?? signal.signal_type}
                    </Badge>
                    <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
                      <span className="font-medium text-slate-600">+{signal.points}</span>
                      <span>{timeAgo(signal.occurred_at)}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Right column ─────────────────────────────────────────────────── */}
        <div className="col-span-2 space-y-4">

          {/* Conversation */}
          <Card>
            <CardHeader>
              <CardTitle>{t('prospects.conversation')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4 max-h-[360px] overflow-y-auto pr-1">
                {messages.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">{t('prospects.noMessages')}</p>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${msg.direction === 'outbound' ? 'flex-row-reverse' : ''}`}
                    >
                      <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                        <AvatarFallback className="text-xs bg-slate-200">
                          {msg.direction === 'outbound' ? 'Me' : initials(prospect.first_name, prospect.last_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                          msg.direction === 'outbound'
                            ? 'bg-blue-500 text-white rounded-tr-sm'
                            : 'bg-slate-100 text-slate-800 rounded-tl-sm'
                        }`}
                      >
                        <p>{msg.content}</p>
                        <div
                          className={`flex items-center gap-1 mt-1 text-xs ${
                            msg.direction === 'outbound' ? 'text-blue-200 justify-end' : 'text-slate-400'
                          }`}
                        >
                          {msg.ai_generated && <Bot className="h-3 w-3" />}
                          {timeAgo(msg.sent_at)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <Separator className="mb-4" />

              <div className="space-y-2">
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t('prospects.messagePlaceholder')}
                  rows={3}
                />
                <div className="flex gap-2 justify-between">
                  <Button variant="outline" size="sm" onClick={handleGenerateMessage} disabled={scoring}>
                    <Bot className="h-3.5 w-3.5 mr-1.5" />
                    {scoring ? t('prospects.generating') : t('prospects.generateWithAi')}
                  </Button>
                  <Button size="sm" onClick={handleSend} disabled={sending || !message.trim()}>
                    <SendHorizonal className="h-3.5 w-3.5 mr-1.5" />
                    {sending ? t('prospects.sending') : 'Envoyer'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Message Sequence */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ListOrdered className="h-5 w-5 text-indigo-500" />
                  Séquence de messages
                  {pendingSteps > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {pendingSteps} en attente
                    </Badge>
                  )}
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGenerateSequence}
                  disabled={generatingSeq || seqQueued}
                >
                  {generatingSeq ? (
                    <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Génération…</>
                  ) : seqQueued ? (
                    <><Clock className="h-3.5 w-3.5 mr-1.5" />En cours…</>
                  ) : (
                    <><Play className="h-3.5 w-3.5 mr-1.5" />{hasSequence ? 'Regénérer' : 'Générer la séquence'}</>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {sequence.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <ListOrdered className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Aucune séquence active.</p>
                  <p className="text-xs mt-1">
                    Cliquez sur &quot;Générer la séquence&quot; pour créer 4 messages automatiques.
                  </p>
                </div>
              ) : (
                <div className="space-y-0">
                  {sequence.map((step, idx) => {
                    const cfg = STEP_STATUS_CONFIG[step.status] ?? STEP_STATUS_CONFIG.pending
                    return (
                      <div key={step.id} className="relative flex gap-3 pb-4">
                        {/* Timeline connector */}
                        {idx < sequence.length - 1 && (
                          <div className="absolute left-4 top-8 bottom-0 w-px bg-slate-200" />
                        )}
                        {/* Step number circle */}
                        <div className={`shrink-0 z-10 h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                          step.status === 'sent' || step.status === 'replied'
                            ? 'bg-green-100 text-green-700'
                            : step.status === 'paused' || step.status === 'skipped'
                            ? 'bg-slate-100 text-slate-400'
                            : 'bg-indigo-100 text-indigo-700'
                        }`}>
                          {step.step}
                        </div>
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-slate-700">
                                  {STEP_LABELS[step.step] ?? `Étape ${step.step}`}
                                </span>
                                <Badge
                                  variant="secondary"
                                  className={`text-xs flex items-center gap-1 ${cfg.color}`}
                                >
                                  {cfg.icon}
                                  {cfg.label}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-400">
                                <Clock className="h-3 w-3" />
                                {step.sent_at
                                  ? `Envoyé ${timeAgo(step.sent_at)}`
                                  : `Planifié ${timeAgo(step.scheduled_at)}`
                                }
                              </div>
                              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed line-clamp-2">
                                {step.content}
                              </p>
                            </div>
                            {/* Pause / Skip buttons — only for pending */}
                            {step.status === 'pending' && (
                              <div className="shrink-0 flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-yellow-600 hover:bg-yellow-50"
                                  onClick={() => handleStepAction(step.id, 'paused')}
                                  title="Mettre en pause"
                                >
                                  <PauseCircle className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-red-500 hover:bg-red-50"
                                  onClick={() => handleStepAction(step.id, 'skipped')}
                                  title="Ignorer"
                                >
                                  <SkipForward className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}

// ─── ScoreBar subcomponent ────────────────────────────────────────────────────

function ScoreBar({
  label,
  icon,
  value,
  max,
  color,
}: {
  label: string
  icon: React.ReactNode
  value: number
  max: number
  color: string
}) {
  const pct = Math.round((value / max) * 100)
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-slate-600">
          {icon} {label}
        </span>
        <span className="font-semibold text-slate-700">{value}/{max}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
