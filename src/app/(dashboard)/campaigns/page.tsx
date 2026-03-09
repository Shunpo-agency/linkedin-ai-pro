'use client'

import { useEffect, useState } from 'react'
import {
  Loader2,
  Megaphone,
  Plus,
  Play,
  Pause,
  CheckCircle2,
  FlaskConical,
  AlertCircle,
  ArrowLeft,
  Send,
  MessageSquare,
  Users,
  Search,
  ChevronRight,
  MapPin,
  Building2,
  Briefcase,
  Settings2,
  RefreshCw,
  UserPlus,
  Star,
  Wand2,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Trash2,
  Sparkles,
  Globe,
} from 'lucide-react'
import type { AgentRun } from '@/modules/campaigns/campaigns.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { formatDate } from '@/shared/utils/date'
import { useT } from '@/lib/i18n/context'
import Link from 'next/link'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type CampaignType = 'prospect_discovery' | 'outreach'
type CampaignStatus = 'active' | 'paused' | 'completed'

interface DiscoveryPersona {
  roles: string[]
  industries: string[]
  companySizes: string[]
  locations: string[]
  keywords: string[]
}

interface AudienceFilters {
  temperatures: string[]
  connectionStatuses: string[]
}

interface Campaign {
  id: string
  name: string
  type: CampaignType
  status: CampaignStatus
  persona_snapshot: DiscoveryPersona | null
  audience_filters: AudienceFilters | null
  ai_behavior: Record<string, unknown> | null | undefined
  daily_invite_limit: number
  prospects_count: number
  messages_sent: number
  replies_count: number
  meetings_booked: number
  started_at: string
  ended_at: string | null
}

interface TestProfile {
  providerId: string
  firstName: string | null
  lastName: string | null
  headline: string | null
  company: string | null
  profilePictureUrl: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<CampaignStatus, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-slate-100 text-slate-600',
}

type TestStep = 'url' | 'generating' | 'preview' | 'sending' | 'done'
type CreateStep = 'choose_type' | 'ai_setup' | 'configure'

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────

function splitCsv(val: string): string[] {
  return val
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

// ─────────────────────────────────────────────────────────────────────────────
// TypeCard — visual campaign type selector
// ─────────────────────────────────────────────────────────────────────────────

interface TypeCardProps {
  icon: React.ReactNode
  title: string
  description: string
  selected: boolean
  onClick: () => void
}

function TypeCard({ icon, title, description, selected, onClick }: TypeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
        selected
          ? 'border-blue-500 bg-blue-50'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            selected ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {icon}
        </div>
        <div>
          <p className={`font-semibold text-sm ${selected ? 'text-blue-700' : 'text-slate-800'}`}>
            {title}
          </p>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PersonaSummary — inline display on discovery campaign cards
// ─────────────────────────────────────────────────────────────────────────────

function PersonaSummary({ persona }: { persona: DiscoveryPersona }) {
  const roleChips = (persona.roles ?? []).slice(0, 3)
  const industryChips = (persona.industries ?? []).slice(0, 2)
  return (
    <div className="mt-2 space-y-1">
      {(persona.locations ?? []).length > 0 && (
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <MapPin className="h-3 w-3 shrink-0" />
          {persona.locations.join(', ')}
        </div>
      )}
      {(persona.companySizes ?? []).length > 0 && (
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Building2 className="h-3 w-3 shrink-0" />
          {persona.companySizes.join(', ')} sal.
        </div>
      )}
      {(roleChips.length > 0 || industryChips.length > 0) && (
        <div className="flex flex-wrap gap-1 mt-1">
          {roleChips.map((r) => (
            <span
              key={r}
              className="inline-flex items-center gap-0.5 rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700"
            >
              <Briefcase className="h-2.5 w-2.5" />
              {r}
            </span>
          ))}
          {industryChips.map((i) => (
            <span
              key={i}
              className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
            >
              {i}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const t = useT()

  const STATUS_LABELS: Record<CampaignStatus, string> = {
    active: t('campaigns.active'),
    paused: t('campaigns.paused'),
    completed: t('campaigns.completed'),
  }

  // ── State ──────────────────────────────────────────────────────────────────
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)

  // New campaign wizard
  const [dialogOpen, setDialogOpen] = useState(false)
  const [createStep, setCreateStep] = useState<CreateStep>('choose_type')
  const [selectedType, setSelectedType] = useState<CampaignType>('prospect_discovery')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')

  // Discovery fields
  const [roles, setRoles] = useState('')
  const [industries, setIndustries] = useState('')
  const [companySizes, setCompanySizes] = useState('')
  const [locations, setLocations] = useState('')
  const [keywords, setKeywords] = useState('')
  const [dailyInviteLimit, setDailyInviteLimit] = useState(15)

  // Outreach fields
  const [outreachTemps, setOutreachTemps] = useState<string[]>(['warm', 'hot'])
  const [outreachConnStatuses, setOutreachConnStatuses] = useState<string[]>(['connected'])
  const [dailyMsgLimit, setDailyMsgLimit] = useState(20)

  // Test bot
  const [testDialogOpen, setTestDialogOpen] = useState(false)
  const [testStep, setTestStep] = useState<TestStep>('url')
  const [testUrl, setTestUrl] = useState('')
  const [testSendMessage, setTestSendMessage] = useState(false)
  const [testProfile, setTestProfile] = useState<TestProfile | null>(null)
  const [testMessage, setTestMessage] = useState('')
  const [testError, setTestError] = useState<string | null>(null)
  const [testProspectId, setTestProspectId] = useState<string | null>(null)

  // Edit campaign
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  // AI behavior
  const [editTone, setEditTone] = useState<'professional' | 'casual' | 'persuasive'>('professional')
  const [editFollowUpDays, setEditFollowUpDays] = useState(3)
  const [editCustomInstructions, setEditCustomInstructions] = useState('')

  // AI setup
  const [aiUrl, setAiUrl] = useState('')
  const [aiInput, setAiInput] = useState('')
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [aiSetupError, setAiSetupError] = useState<string | null>(null)
  const [aiSuggested, setAiSuggested] = useState(false)

  // Delete campaign
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Activity panel
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null)
  const [activityData, setActivityData] = useState<Record<string, AgentRun[]>>({})
  const [activityLoading, setActivityLoading] = useState<Record<string, boolean>>({})

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchCampaigns()
  }, [])

  // ── Campaign CRUD ──────────────────────────────────────────────────────────

  async function fetchCampaigns(): Promise<void> {
    setLoading(true)
    try {
      const res = await fetch('/api/campaigns')
      const data = await res.json()
      setCampaigns(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }

  function resetCreateDialog(): void {
    setCreateStep('choose_type')
    setSelectedType('prospect_discovery')
    setNewName('')
    setRoles('')
    setIndustries('')
    setCompanySizes('')
    setLocations('')
    setKeywords('')
    setDailyInviteLimit(15)
    setOutreachTemps(['warm', 'hot'])
    setOutreachConnStatuses(['connected'])
    setDailyMsgLimit(20)
    setCreateError(null)
    setAiUrl('')
    setAiInput('')
    setAiSetupError(null)
    setAiSuggested(false)
  }

  async function handleCreate(): Promise<void> {
    if (!newName.trim()) return
    setCreating(true)
    setCreateError(null)
    try {
      const body =
        selectedType === 'prospect_discovery'
          ? {
              name: newName.trim(),
              type: 'prospect_discovery',
              persona_snapshot: {
                roles: splitCsv(roles),
                industries: splitCsv(industries),
                companySizes: splitCsv(companySizes),
                locations: splitCsv(locations),
                keywords: splitCsv(keywords),
              },
              daily_invite_limit: dailyInviteLimit,
              status: 'paused',
            }
          : {
              name: newName.trim(),
              type: 'outreach',
              audience_filters: {
                temperatures: outreachTemps,
                connectionStatuses: outreachConnStatuses,
              },
              daily_invite_limit: dailyMsgLimit,
              status: 'paused',
            }

      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) {
        setCreateError(data.error)
        return
      }
      setCampaigns((prev) => [data as Campaign, ...prev])
      setDialogOpen(false)
      resetCreateDialog()
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string): Promise<void> {
    setDeleting(true)
    try {
      await fetch(`/api/campaigns/${id}`, { method: 'DELETE' })
      setCampaigns((prev) => prev.filter((c) => c.id !== id))
      setDeleteConfirmId(null)
    } finally {
      setDeleting(false)
    }
  }

  async function handleAiSetup(): Promise<void> {
    if (!aiInput.trim() && !aiUrl.trim()) return
    setAiAnalyzing(true)
    setAiSetupError(null)
    try {
      const res = await fetch('/api/campaigns/ai-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: aiUrl.trim() || undefined,
          description: aiInput.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (data.error) {
        setAiSetupError(data.error)
        return
      }
      // Auto-fill targeting fields from AI response
      setNewName(data.campaign_name ?? '')
      setRoles((data.roles ?? []).join(', '))
      setIndustries((data.industries ?? []).join(', '))
      setCompanySizes((data.company_sizes ?? []).join(', '))
      setLocations((data.locations ?? []).join(', '))
      setKeywords((data.keywords ?? []).join(', '))
      setDailyInviteLimit(data.daily_invite_limit ?? 15)
      setAiSuggested(true)
      setCreateStep('configure')
    } finally {
      setAiAnalyzing(false)
    }
  }

  async function handleStatusChange(id: string, status: CampaignStatus): Promise<void> {
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (!data.error) {
        setCampaigns((prev) => prev.map((c) => (c.id === id ? (data as Campaign) : c)))
      }
    } catch {
      // noop
    }
  }

  // ── Test bot ───────────────────────────────────────────────────────────────

  function resetTest(): void {
    setTestStep('url')
    setTestUrl('')
    setTestSendMessage(false)
    setTestProfile(null)
    setTestMessage('')
    setTestError(null)
    setTestProspectId(null)
  }

  async function handleGenerate(): Promise<void> {
    if (!testUrl.trim()) return
    setTestError(null)
    setTestStep('generating')
    try {
      const res = await fetch('/api/linkedin/test-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedinUrl: testUrl.trim() }),
      })
      const data = await res.json()
      if (data.error) {
        setTestError(data.error as string)
        setTestStep('url')
        return
      }
      setTestProfile(data.profile as TestProfile)
      setTestMessage(data.generatedMessage ?? '')
      setTestProspectId(data.prospectId ?? null)
      setTestStep('preview')
    } catch {
      setTestError(t('common.networkError'))
      setTestStep('url')
    }
  }

  async function handleSend(): Promise<void> {
    if (!testProfile || !testMessage.trim()) return
    setTestStep('sending')
    try {
      const res = await fetch('/api/linkedin/test-prospect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkedinUrl: testUrl.trim(),
          note: testMessage.trim(),
          sendMessage: testSendMessage,
          prospectId: testProspectId,
        }),
      })
      const data = await res.json()
      if (data.error) {
        setTestError(data.error as string)
        setTestStep('preview')
        return
      }
      setTestStep('done')
    } catch {
      setTestError(t('common.networkError'))
      setTestStep('preview')
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  const replyRate = (c: Campaign): string => {
    if (c.messages_sent === 0) return '0%'
    return `${Math.round((c.replies_count / c.messages_sent) * 100)}%`
  }

  const profileName = testProfile
    ? `${testProfile.firstName ?? ''} ${testProfile.lastName ?? ''}`.trim() || 'Unknown'
    : ''

  function toggleOutreachTemp(temp: string): void {
    setOutreachTemps((prev) =>
      prev.includes(temp) ? prev.filter((x) => x !== temp) : [...prev, temp],
    )
  }

  function toggleConnStatus(status: string): void {
    setOutreachConnStatuses((prev) =>
      prev.includes(status) ? prev.filter((x) => x !== status) : [...prev, status],
    )
  }

  function openEditDialog(c: Campaign): void {
    setEditingCampaign(c)
    setNewName(c.name)
    setDailyInviteLimit(c.daily_invite_limit)
    setDailyMsgLimit(c.daily_invite_limit)
    // Discovery persona
    const p = c.persona_snapshot as Record<string, string[]> | null
    setRoles((p?.roles ?? []).join(', '))
    setIndustries((p?.industries ?? []).join(', '))
    setCompanySizes((p?.companySizes ?? []).join(', '))
    setLocations((p?.locations ?? []).join(', '))
    setKeywords((p?.keywords ?? []).join(', '))
    // Outreach filters
    const af = c.audience_filters as Record<string, string[]> | null
    setOutreachTemps(af?.temperatures ?? ['warm', 'hot'])
    setOutreachConnStatuses(af?.connectionStatuses ?? ['connected'])
    // AI behavior
    const ai = c.ai_behavior as Record<string, unknown> | null
    setEditTone((ai?.tone as 'professional' | 'casual' | 'persuasive') ?? 'professional')
    setEditFollowUpDays((ai?.followUpDelayDays as number) ?? 3)
    setEditCustomInstructions((ai?.customInstructions as string) ?? '')
    setEditError(null)
    setEditDialogOpen(true)
  }

  async function handleSaveEdit(): Promise<void> {
    if (!editingCampaign || !newName.trim()) return
    setEditSaving(true)
    setEditError(null)
    try {
      const body = editingCampaign.type === 'prospect_discovery'
        ? {
            name: newName.trim(),
            persona_snapshot: {
              roles: splitCsv(roles),
              industries: splitCsv(industries),
              companySizes: splitCsv(companySizes),
              locations: splitCsv(locations),
              keywords: splitCsv(keywords),
            },
            daily_invite_limit: dailyInviteLimit,
            ai_behavior: { tone: editTone, followUpDelayDays: editFollowUpDays, customInstructions: editCustomInstructions || undefined },
          }
        : {
            name: newName.trim(),
            audience_filters: { temperatures: outreachTemps, connectionStatuses: outreachConnStatuses },
            daily_invite_limit: dailyMsgLimit,
            ai_behavior: { tone: editTone, followUpDelayDays: editFollowUpDays, customInstructions: editCustomInstructions || undefined },
          }

      const res = await fetch(`/api/campaigns/${editingCampaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) { setEditError(data.error as string); return }
      setCampaigns((prev) => prev.map((c) => (c.id === editingCampaign.id ? (data as Campaign) : c)))
      setEditDialogOpen(false)
      setEditingCampaign(null)
    } finally {
      setEditSaving(false)
    }
  }

  async function toggleActivity(id: string): Promise<void> {
    if (expandedActivity === id) {
      setExpandedActivity(null)
      return
    }
    setExpandedActivity(id)
    if (activityData[id]) return // already loaded
    setActivityLoading((prev) => ({ ...prev, [id]: true }))
    try {
      const res = await fetch(`/api/campaigns/${id}/activity`)
      const data = await res.json()
      setActivityData((prev) => ({ ...prev, [id]: Array.isArray(data) ? data : [] }))
    } finally {
      setActivityLoading((prev) => ({ ...prev, [id]: false }))
    }
  }

  function getIntentIcon(intentType: string): React.ReactNode {
    const cls = 'h-3.5 w-3.5'
    switch (intentType) {
      case 'FIND_PROSPECTS': return <Search className={cls} />
      case 'SEND_CONNECTION_REQUEST': return <UserPlus className={cls} />
      case 'SEND_MESSAGE': return <MessageSquare className={cls} />
      case 'FOLLOW_UP': return <RefreshCw className={cls} />
      case 'SCORE_LEAD': return <Star className={cls} />
      case 'REFINE_PERSONA': return <Wand2 className={cls} />
      case 'BOOK_MEETING': return <Calendar className={cls} />
      default: return <MessageSquare className={cls} />
    }
  }

  function getIntentLabel(intentType: string): string {
    const labels: Record<string, string> = {
      FIND_PROSPECTS: 'Découverte de prospects',
      SEND_CONNECTION_REQUEST: 'Demande de connexion',
      SEND_MESSAGE: 'Envoi de message',
      FOLLOW_UP: 'Relance',
      SCORE_LEAD: 'Scoring lead',
      REFINE_PERSONA: 'Optimisation persona',
      BOOK_MEETING: 'Réservation meeting',
      GENERATE_SEQUENCE: 'Génération séquence',
      SEND_SEQUENCE: 'Envoi séquence',
      PROFILE_ANALYSIS: 'Analyse de profil',
    }
    return labels[intentType] ?? intentType
  }

  function summarizeResult(intentType: string, result: Record<string, unknown> | null): string {
    if (!result) return ''
    switch (intentType) {
      case 'FIND_PROSPECTS':
        return `${result.created ?? 0} créés · ${result.queued ?? 0} invitations`
      case 'FOLLOW_UP':
        return `${result.count ?? 0} relances`
      case 'SCORE_LEAD':
        return result.score ? `Score ${result.score}/100` : ''
      case 'SEND_SEQUENCE':
        return result.sent ? `${result.sent} message(s) envoyé(s)` : ''
      default:
        return ''
    }
  }

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "à l'instant"
    if (mins < 60) return `il y a ${mins}min`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `il y a ${hours}h`
    return `il y a ${Math.floor(hours / 24)}j`
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('campaigns.title')}</h1>
          <p className="text-slate-500 text-sm mt-1">{t('campaigns.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">

          {/* ── Test bot dialog ── */}
          <Dialog
            open={testDialogOpen}
            onOpenChange={(open) => {
              setTestDialogOpen(open)
              if (!open) resetTest()
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline">
                <FlaskConical className="h-4 w-4 mr-1.5" />
                {t('campaigns.testBot')}
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[min(448px,calc(100vw-2rem))] overflow-hidden">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {(testStep === 'preview' || testStep === 'sending' || testStep === 'done') && (
                    <button onClick={resetTest} className="text-slate-400 hover:text-slate-600 mr-1">
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                  )}
                  {t('campaigns.testTitle')}
                </DialogTitle>
              </DialogHeader>

              {(testStep === 'url' || testStep === 'generating') && (
                <div className="space-y-4 min-w-0">
                  <p className="text-sm text-slate-500">{t('campaigns.testDescription')}</p>
                  <div className="space-y-2">
                    <Label>{t('campaigns.testUrlLabel')}</Label>
                    <Input
                      value={testUrl}
                      onChange={(e) => setTestUrl(e.target.value)}
                      placeholder={t('campaigns.testUrlPlaceholder')}
                      type="url"
                      disabled={testStep === 'generating'}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleGenerate() }}
                      className="w-full"
                    />
                  </div>
                  {testError && (
                    <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      {testError}
                    </div>
                  )}
                  <Button onClick={handleGenerate} disabled={testStep === 'generating' || !testUrl.trim()} className="w-full">
                    {testStep === 'generating' ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" />{t('campaigns.generating')}</>
                    ) : (
                      <><FlaskConical className="h-4 w-4 mr-2" />{t('campaigns.generatePreview')}</>
                    )}
                  </Button>
                </div>
              )}

              {(testStep === 'preview' || testStep === 'sending') && testProfile && (
                <div className="space-y-4 min-w-0">
                  <div className="flex items-center gap-3 rounded-md border p-3 bg-slate-50">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={testProfile.profilePictureUrl ?? ''} alt={profileName} />
                      <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold text-sm">
                        {profileName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{profileName}</p>
                      {testProfile.headline && <p className="text-xs text-slate-500 truncate">{testProfile.headline}</p>}
                      {testProfile.company && <p className="text-xs text-slate-400 truncate">{testProfile.company}</p>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-md border px-3 py-2">
                    <div className="min-w-0 mr-3">
                      <p className="text-sm font-medium">{testSendMessage ? t('campaigns.directMessage') : t('campaigns.connectionRequest')}</p>
                      <p className="text-xs text-slate-400">{testSendMessage ? t('campaigns.connectedHint') : t('campaigns.notConnectedHint')}</p>
                    </div>
                    <Switch checked={testSendMessage} onCheckedChange={setTestSendMessage} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('campaigns.aiMessage')} <span className="text-slate-400 font-normal text-xs">{t('campaigns.editable')}</span></Label>
                    <Textarea value={testMessage} onChange={(e) => setTestMessage(e.target.value)} rows={5} maxLength={300} disabled={testStep === 'sending'} className="resize-none w-full" />
                    <p className="text-xs text-slate-400 text-right">{testMessage.length}/300</p>
                  </div>
                  {testError && (
                    <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />{testError}
                    </div>
                  )}
                  <Button onClick={handleSend} disabled={testStep === 'sending' || !testMessage.trim()} className="w-full">
                    {testStep === 'sending' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                    {testStep === 'sending' ? t('common.sending') : testSendMessage ? `${t('campaigns.sendMessage')} ${profileName}` : `${t('campaigns.sendInvitation')} ${profileName}`}
                  </Button>
                </div>
              )}

              {testStep === 'done' && (
                <div className="space-y-4">
                  <div className="flex flex-col items-center text-center py-4 space-y-3">
                    <CheckCircle2 className="h-12 w-12 text-green-500" />
                    <div>
                      <p className="font-semibold text-base">{testSendMessage ? t('campaigns.messageSent') : t('campaigns.invitationSent')}</p>
                      <p className="text-sm text-slate-500 mt-1">
                        {testSendMessage ? `${t('campaigns.messageSuccess')} ${profileName}.` : `${t('campaigns.invitationSuccess')} ${profileName}. ${t('campaigns.invitationFollowUp')}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link href="/messages" className="flex-1" onClick={() => setTestDialogOpen(false)}>
                      <Button variant="outline" size="sm" className="w-full"><MessageSquare className="h-3.5 w-3.5 mr-1.5" />{t('campaigns.viewInMessages')}</Button>
                    </Link>
                    {testProspectId && (
                      <Link href={`/prospects/${testProspectId}`} className="flex-1" onClick={() => setTestDialogOpen(false)}>
                        <Button variant="outline" size="sm" className="w-full"><Users className="h-3.5 w-3.5 mr-1.5" />{t('campaigns.viewProspect')}</Button>
                      </Link>
                    )}
                  </div>
                  <Button variant="outline" className="w-full" onClick={resetTest}>{t('campaigns.testAnother')}</Button>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* ── New campaign wizard ── */}
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open)
              if (!open) resetCreateDialog()
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-1.5" />
                {t('campaigns.newCampaign')}
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[min(520px,calc(100vw-2rem))] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {(createStep === 'ai_setup' || createStep === 'configure') && (
                    <button
                      type="button"
                      onClick={() => {
                        if (createStep === 'configure') {
                          setCreateStep(selectedType === 'prospect_discovery' ? 'ai_setup' : 'choose_type')
                        } else {
                          setCreateStep('choose_type')
                        }
                      }}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                  )}
                  {createStep === 'choose_type' && t('campaigns.chooseCampaignType')}
                  {createStep === 'ai_setup' && (
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-indigo-500" />
                      Configuration intelligente
                    </span>
                  )}
                  {createStep === 'configure' && (
                    selectedType === 'prospect_discovery'
                      ? t('campaigns.configureDiscovery')
                      : t('campaigns.configureOutreach')
                  )}
                </DialogTitle>
              </DialogHeader>

              {/* ── Step 1: Choose type ── */}
              {createStep === 'choose_type' && (
                <div className="space-y-3 pt-2">
                  <TypeCard
                    icon={<Search className="h-5 w-5" />}
                    title={t('campaigns.typeDiscoveryTitle')}
                    description={t('campaigns.typeDiscoveryDesc')}
                    selected={selectedType === 'prospect_discovery'}
                    onClick={() => setSelectedType('prospect_discovery')}
                  />
                  <TypeCard
                    icon={<MessageSquare className="h-5 w-5" />}
                    title={t('campaigns.typeOutreachTitle')}
                    description={t('campaigns.typeOutreachDesc')}
                    selected={selectedType === 'outreach'}
                    onClick={() => setSelectedType('outreach')}
                  />
                  <Button
                    className="w-full mt-2"
                    onClick={() => setCreateStep(selectedType === 'prospect_discovery' ? 'ai_setup' : 'configure')}
                  >
                    {t('common.next')}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}

              {/* ── Step 1.5: AI Setup ── */}
              {createStep === 'ai_setup' && (
                <div className="space-y-4 pt-2">
                  <p className="text-sm text-slate-500">
                    Décrivez votre activité ou collez l&apos;URL de votre site — l&apos;IA définit automatiquement votre ciblage LinkedIn idéal.
                  </p>

                  <div className="space-y-2">
                    <Label className="text-xs flex items-center gap-1.5 text-slate-600">
                      <Globe className="h-3.5 w-3.5" />
                      URL de votre site <span className="text-slate-400">(optionnel)</span>
                    </Label>
                    <Input
                      value={aiUrl}
                      onChange={(e) => setAiUrl(e.target.value)}
                      placeholder="https://monsite.com"
                      type="url"
                      disabled={aiAnalyzing}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-slate-600">
                      Description de votre activité et de votre client idéal
                    </Label>
                    <Textarea
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      placeholder="Ex : Nous aidons les PME industrielles à réduire leurs coûts de maintenance grâce à une solution IoT. Notre client idéal est le directeur industriel ou responsable maintenance dans des entreprises de 50 à 500 personnes, principalement en France et Belgique..."
                      rows={5}
                      disabled={aiAnalyzing}
                    />
                  </div>

                  {aiSetupError && (
                    <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      {aiSetupError}
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      className="flex-1 text-slate-500"
                      onClick={() => setCreateStep('configure')}
                      disabled={aiAnalyzing}
                    >
                      Configurer manuellement
                    </Button>
                    <Button
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                      onClick={handleAiSetup}
                      disabled={aiAnalyzing || (!aiInput.trim() && !aiUrl.trim())}
                    >
                      {aiAnalyzing ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" />Analyse en cours…</>
                      ) : (
                        <><Sparkles className="h-4 w-4 mr-2" />Générer le ciblage</>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* ── Step 2a: Configure Discovery ── */}
              {createStep === 'configure' && selectedType === 'prospect_discovery' && (
                <div className="space-y-4 pt-2">
                  {aiSuggested && (
                    <div className="flex items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5">
                      <Sparkles className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                      <div className="text-xs text-indigo-700">
                        <span className="font-semibold">Ciblage généré par l&apos;IA</span> — Vous pouvez modifier les champs ci-dessous avant de créer la campagne.
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>{t('campaigns.campaignName')}</Label>
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder={t('campaigns.discoveryNamePlaceholder')}
                      autoFocus
                    />
                  </div>

                  <Separator />
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {t('campaigns.personaConfig')}
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">{t('campaigns.personaRoles')}</Label>
                      <Input value={roles} onChange={(e) => setRoles(e.target.value)} placeholder="DRH, Directeur RH" className="text-sm" />
                      <p className="text-[11px] text-slate-400">{t('campaigns.csvHint')}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('campaigns.personaIndustries')}</Label>
                      <Input value={industries} onChange={(e) => setIndustries(e.target.value)} placeholder="BTP, Tech, Finance" className="text-sm" />
                      <p className="text-[11px] text-slate-400">{t('campaigns.csvHint')}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('campaigns.personaCompanySizes')}</Label>
                      <Input value={companySizes} onChange={(e) => setCompanySizes(e.target.value)} placeholder="50-200, 200-1000" className="text-sm" />
                      <p className="text-[11px] text-slate-400">{t('campaigns.csvHint')}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('campaigns.personaLocations')}</Label>
                      <Input value={locations} onChange={(e) => setLocations(e.target.value)} placeholder="France, Île-de-France" className="text-sm" />
                      <p className="text-[11px] text-slate-400">{t('campaigns.csvHint')}</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">{t('campaigns.personaKeywords')}</Label>
                    <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="recrutement, croissance, expansion" className="text-sm" />
                    <p className="text-[11px] text-slate-400">{t('campaigns.csvHint')}</p>
                  </div>

                  <Separator />

                  <div className="space-y-1">
                    <Label className="text-xs">{t('campaigns.dailyInviteLimit')}</Label>
                    <Input type="number" min={1} max={50} value={dailyInviteLimit} onChange={(e) => setDailyInviteLimit(Number(e.target.value))} className="text-sm w-28" />
                    <p className="text-[11px] text-slate-400">{t('campaigns.dailyInviteLimitHint')}</p>
                  </div>

                  {createError && (
                    <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />{createError}
                    </div>
                  )}

                  <Button onClick={handleCreate} disabled={creating || !newName.trim()} className="w-full">
                    {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    {creating ? t('common.creating') : t('campaigns.createDiscoveryCampaign')}
                  </Button>
                </div>
              )}

              {/* ── Step 2b: Configure Outreach ── */}
              {createStep === 'configure' && selectedType === 'outreach' && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>{t('campaigns.campaignName')}</Label>
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder={t('campaigns.outreachNamePlaceholder')}
                      autoFocus
                    />
                  </div>

                  <Separator />
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {t('campaigns.audienceFilters')}
                  </p>

                  {/* Temperature filter */}
                  <div className="space-y-2">
                    <Label className="text-xs">{t('campaigns.filterTemperature')}</Label>
                    <div className="flex gap-2 flex-wrap">
                      {(['cold', 'warm', 'hot'] as const).map((temp) => (
                        <button
                          key={temp}
                          type="button"
                          onClick={() => toggleOutreachTemp(temp)}
                          className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                            outreachTemps.includes(temp)
                              ? temp === 'cold'
                                ? 'bg-blue-100 text-blue-700 border-blue-300'
                                : temp === 'warm'
                                  ? 'bg-orange-100 text-orange-700 border-orange-300'
                                  : 'bg-red-100 text-red-700 border-red-300'
                              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {t(`prospects.${temp}`)}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-400">{t('campaigns.filterTempHint')}</p>
                  </div>

                  {/* Connection status filter */}
                  <div className="space-y-2">
                    <Label className="text-xs">{t('campaigns.filterConnectionStatus')}</Label>
                    <div className="flex gap-2 flex-wrap">
                      {(
                        [
                          { key: 'not_connected', label: t('prospects.notConnected') },
                          { key: 'pending', label: t('prospects.invited') },
                          { key: 'connected', label: t('prospects.connected') },
                        ] as const
                      ).map(({ key, label }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggleConnStatus(key)}
                          className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                            outreachConnStatuses.includes(key)
                              ? 'bg-blue-100 text-blue-700 border-blue-300'
                              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-400">{t('campaigns.filterConnHint')}</p>
                  </div>

                  <Separator />

                  <div className="space-y-1">
                    <Label className="text-xs">{t('campaigns.dailyMsgLimit')}</Label>
                    <Input type="number" min={1} max={100} value={dailyMsgLimit} onChange={(e) => setDailyMsgLimit(Number(e.target.value))} className="text-sm w-28" />
                    <p className="text-[11px] text-slate-400">{t('campaigns.dailyMsgLimitHint')}</p>
                  </div>

                  {createError && (
                    <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />{createError}
                    </div>
                  )}

                  <Button onClick={handleCreate} disabled={creating || !newName.trim()} className="w-full">
                    {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    {creating ? t('common.creating') : t('campaigns.createOutreachCampaign')}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* ── Edit campaign dialog ── */}
          <Dialog open={editDialogOpen} onOpenChange={(open) => { setEditDialogOpen(open); if (!open) setEditingCampaign(null) }}>
            <DialogContent className="w-[min(520px,calc(100vw-2rem))] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Modifier la campagne</DialogTitle>
              </DialogHeader>
              {editingCampaign && (
                <div className="space-y-4 pt-2">
                  {/* Name */}
                  <div className="space-y-2">
                    <Label>{t('campaigns.campaignName')}</Label>
                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
                  </div>

                  <Separator />

                  {/* Discovery persona */}
                  {editingCampaign.type === 'prospect_discovery' && (
                    <>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('campaigns.personaConfig')}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">{t('campaigns.personaRoles')}</Label>
                          <Input value={roles} onChange={(e) => setRoles(e.target.value)} className="text-sm" />
                          <p className="text-[11px] text-slate-400">{t('campaigns.csvHint')}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{t('campaigns.personaIndustries')}</Label>
                          <Input value={industries} onChange={(e) => setIndustries(e.target.value)} className="text-sm" />
                          <p className="text-[11px] text-slate-400">{t('campaigns.csvHint')}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{t('campaigns.personaCompanySizes')}</Label>
                          <Input value={companySizes} onChange={(e) => setCompanySizes(e.target.value)} className="text-sm" />
                          <p className="text-[11px] text-slate-400">{t('campaigns.csvHint')}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{t('campaigns.personaLocations')}</Label>
                          <Input value={locations} onChange={(e) => setLocations(e.target.value)} className="text-sm" />
                          <p className="text-[11px] text-slate-400">{t('campaigns.csvHint')}</p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t('campaigns.personaKeywords')}</Label>
                        <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} className="text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t('campaigns.dailyInviteLimit')}</Label>
                        <Input type="number" min={1} max={50} value={dailyInviteLimit} onChange={(e) => setDailyInviteLimit(Number(e.target.value))} className="text-sm w-28" />
                      </div>
                    </>
                  )}

                  {/* Outreach filters */}
                  {editingCampaign.type === 'outreach' && (
                    <>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('campaigns.audienceFilters')}</p>
                      <div className="space-y-2">
                        <Label className="text-xs">{t('campaigns.filterTemperature')}</Label>
                        <div className="flex gap-2 flex-wrap">
                          {(['cold', 'warm', 'hot'] as const).map((temp) => (
                            <button key={temp} type="button" onClick={() => toggleOutreachTemp(temp)}
                              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${outreachTemps.includes(temp) ? temp === 'cold' ? 'bg-blue-100 text-blue-700 border-blue-300' : temp === 'warm' ? 'bg-orange-100 text-orange-700 border-orange-300' : 'bg-red-100 text-red-700 border-red-300' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                              {temp === 'cold' ? t('prospects.cold') : temp === 'warm' ? t('prospects.warm') : t('prospects.hot')}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">{t('campaigns.filterConnectionStatus')}</Label>
                        <div className="flex gap-2 flex-wrap">
                          {([{ key: 'not_connected', label: t('prospects.notConnected') }, { key: 'pending', label: t('prospects.invited') }, { key: 'connected', label: t('prospects.connected') }] as const).map(({ key, label }) => (
                            <button key={key} type="button" onClick={() => toggleConnStatus(key)}
                              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${outreachConnStatuses.includes(key) ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t('campaigns.dailyMsgLimit')}</Label>
                        <Input type="number" min={1} max={100} value={dailyMsgLimit} onChange={(e) => setDailyMsgLimit(Number(e.target.value))} className="text-sm w-28" />
                      </div>
                    </>
                  )}

                  <Separator />

                  {/* AI Behavior */}
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Comportement du bot</p>

                  <div className="space-y-2">
                    <Label className="text-xs">Ton des messages</Label>
                    <div className="flex gap-2">
                      {(['professional', 'casual', 'persuasive'] as const).map((tone) => {
                        const labels = { professional: 'Professionnel', casual: 'Décontracté', persuasive: 'Persuasif' }
                        return (
                          <button key={tone} type="button" onClick={() => setEditTone(tone)}
                            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${editTone === tone ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                            {labels[tone]}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Délai de relance (jours)</Label>
                    <Input type="number" min={1} max={30} value={editFollowUpDays} onChange={(e) => setEditFollowUpDays(Number(e.target.value))} className="text-sm w-28" />
                    <p className="text-[11px] text-slate-400">Jours sans réponse avant une relance automatique</p>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Instructions personnalisées</Label>
                    <Textarea
                      value={editCustomInstructions}
                      onChange={(e) => setEditCustomInstructions(e.target.value)}
                      placeholder="Ex : Mentionne toujours les résultats chiffrés. Ne propose jamais un call avant le 2ème message..."
                      rows={3}
                      maxLength={500}
                      className="resize-none text-sm"
                    />
                    <p className="text-[11px] text-slate-400 text-right">{editCustomInstructions.length}/500</p>
                  </div>

                  {editError && (
                    <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />{editError}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setEditDialogOpen(false)}>
                      {t('common.cancel')}
                    </Button>
                    <Button className="flex-1" onClick={handleSaveEdit} disabled={editSaving || !newName.trim()}>
                      {editSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      {editSaving ? t('common.saving') : 'Enregistrer'}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── Campaign list ── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Megaphone className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p>{t('campaigns.noCampaigns')}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {campaigns.map((c) => (
            <Card
              key={c.id}
              className={`relative overflow-hidden transition-shadow ${
                c.status === 'active' ? 'ring-1 ring-green-200 shadow-sm shadow-green-100' : ''
              }`}
            >
              {/* Animated scanning bar — visible only when active */}
              {c.status === 'active' && (
                <div className="absolute top-0 left-0 right-0 h-0.5 overflow-hidden bg-green-100">
                  <div className="agent-scan-bar" />
                </div>
              )}
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    {/* Type badge */}
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium mb-1 ${
                        c.type === 'prospect_discovery'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {c.type === 'prospect_discovery' ? (
                        <Search className="h-3 w-3" />
                      ) : (
                        <MessageSquare className="h-3 w-3" />
                      )}
                      {c.type === 'prospect_discovery'
                        ? t('campaigns.typeDiscoveryLabel')
                        : t('campaigns.typeOutreachLabel')}
                    </span>

                    <CardTitle className="text-base font-semibold">{c.name}</CardTitle>

                    {/* Persona summary */}
                    {c.type === 'prospect_discovery' && c.persona_snapshot && (
                      <PersonaSummary persona={c.persona_snapshot as DiscoveryPersona} />
                    )}

                    {/* Audience filter chips */}
                    {c.type === 'outreach' && c.audience_filters && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {((c.audience_filters as AudienceFilters).temperatures ?? []).map((temp) => (
                          <span
                            key={temp}
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              temp === 'cold'
                                ? 'bg-blue-50 text-blue-600'
                                : temp === 'warm'
                                  ? 'bg-orange-50 text-orange-600'
                                  : 'bg-red-50 text-red-600'
                            }`}
                          >
                            {temp === 'cold' ? t('prospects.cold') : temp === 'warm' ? t('prospects.warm') : t('prospects.hot')}
                          </span>
                        ))}
                        {((c.audience_filters as AudienceFilters).connectionStatuses ?? []).map((s) => (
                          <span key={s} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                            {s === 'connected' ? t('prospects.connected') : s === 'pending' ? t('prospects.invited') : t('prospects.notConnected')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Status + actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditDialog(c)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                      title="Modifier"
                    >
                      <Settings2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(c.id)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <Badge className={STATUS_COLORS[c.status]} variant="secondary">
                      {c.status === 'active' && <Play className="h-3 w-3 mr-1" />}
                      {c.status === 'paused' && <Pause className="h-3 w-3 mr-1" />}
                      {c.status === 'completed' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                      {STATUS_LABELS[c.status]}
                    </Badge>
                    {c.status === 'paused' && (
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleStatusChange(c.id, 'active')}>
                        <Play className="h-3.5 w-3.5 mr-1" />{t('campaigns.activateBot')}
                      </Button>
                    )}
                    {c.status === 'active' && (
                      <Button variant="outline" size="sm" onClick={() => handleStatusChange(c.id, 'paused')}>
                        <Pause className="h-3.5 w-3.5 mr-1" />{t('campaigns.pause')}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">{c.prospects_count}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{t('campaigns.prospects')}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{c.messages_sent}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{t('campaigns.messagesSent')}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{replyRate(c)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{t('campaigns.replyRate')}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{c.meetings_booked}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{t('campaigns.meetings')}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <p className="text-xs text-slate-400">
                    {t('campaigns.started')} {formatDate(c.started_at)}
                    {c.ended_at ? ` ${t('campaigns.ended')} ${formatDate(c.ended_at)}` : ''}
                  </p>
                  {c.status === 'active' ? (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                      </span>
                      Agent actif
                      <span className="flex items-center gap-0.5 ml-0.5">
                        <span className="agent-dot inline-block h-1 w-1 rounded-full bg-green-500" />
                        <span className="agent-dot inline-block h-1 w-1 rounded-full bg-green-500" />
                        <span className="agent-dot inline-block h-1 w-1 rounded-full bg-green-500" />
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">
                      {c.daily_invite_limit}{' '}
                      {c.type === 'prospect_discovery'
                        ? t('campaigns.invitesPerDay')
                        : t('campaigns.messagesPerDay')}
                    </p>
                  )}
                </div>
              </CardContent>

              {/* Activity panel */}
              <div className="border-t">
                <button
                  type="button"
                  onClick={() => toggleActivity(c.id)}
                  className="w-full flex items-center justify-between px-6 py-2.5 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Historique d&apos;activité
                  </span>
                  {expandedActivity === c.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>

                {expandedActivity === c.id && (
                  <div className="px-6 pb-4">
                    {activityLoading[c.id] ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                      </div>
                    ) : (activityData[c.id] ?? []).length === 0 ? (
                      <p className="text-xs text-slate-400 py-3 text-center">Aucune activité enregistrée pour cette campagne.</p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {(activityData[c.id] ?? []).map((run) => (
                          <div key={run.id} className="flex items-start gap-3 text-xs">
                            <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                              run.status === 'success' || run.status === 'completed'
                                ? 'bg-green-100 text-green-600'
                                : run.status === 'failed'
                                  ? 'bg-red-100 text-red-600'
                                  : 'bg-slate-100 text-slate-500'
                            }`}>
                              {getIntentIcon(run.intent_type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium text-slate-700">{getIntentLabel(run.intent_type)}</span>
                                <span className="text-slate-400 shrink-0">{timeAgo(run.started_at)}</span>
                              </div>
                              {run.status === 'failed' && run.error && (
                                <p className="text-red-600 truncate">{run.error}</p>
                              )}
                              {run.status !== 'failed' && (
                                <p className="text-slate-500">{summarizeResult(run.intent_type, run.result)}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Supprimer la campagne
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Cette action est irréversible. La campagne et tout son historique d&apos;activité seront supprimés définitivement.
          </p>
          <div className="flex gap-3 justify-end mt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)} disabled={deleting}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={deleting}
            >
              {deleting ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Suppression…</> : 'Supprimer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
