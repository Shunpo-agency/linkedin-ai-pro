'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { useT } from '@/lib/i18n/context'

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

export default function AgentAIPage() {
  const t = useT()
  const { toast } = useToast()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const form = useForm<AgentForm>({
    resolver: zodResolver(AgentFormSchema),
    defaultValues: {
      target_roles: '',
      target_industries: '',
      target_company_sizes: '',
      target_locations: '',
      target_keywords: '',
      ai_tone: 'professional',
      ai_follow_up_delay: 3,
      ai_daily_limit: 20,
      calendar_link: '',
      ai_opener: '',
      full_auto: false,
    },
  })

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
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
      })
      .catch(() => {})
  }, [form])

  const splitCsv = (val?: string): string[] =>
    (val ?? '').split(',').map((s) => s.trim()).filter(Boolean)

  const saveSettings = useCallback(async (values: AgentForm): Promise<void> => {
    try {
      // Only send the AI / persona fields this form manages.
      // Thanks to the partial upsert in the repository, business info is never overwritten.
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
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        toast({ title: t('common.saveFailed'), variant: 'destructive' })
      }
      // On success: no toast for auto-save (silent is fine for debounced saves)
    } catch {
      toast({ title: t('common.networkError'), variant: 'destructive' })
    }
  }, [toast, t])

  useEffect(() => {
    const subscription = form.watch(() => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        form.handleSubmit(saveSettings)(new Event('submit') as unknown as React.BaseSyntheticEvent)
      }, 800)
    })
    return () => {
      subscription.unsubscribe()
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [form, saveSettings])

  const fullAuto = form.watch('full_auto')

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{t('agentAi.title')}</h1>
        <p className="text-slate-500 text-sm mt-1">{t('agentAi.subtitle')}</p>
      </div>

      <form>
        {/* Target Persona */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('agentAi.targetPersona')}</CardTitle>
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
                <Input {...form.register('target_locations')} placeholder="France, UK, USA" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('agentAi.keywords')}</Label>
              <Input {...form.register('target_keywords')} placeholder="hiring, AI, automation, growth, expansion" />
            </div>
          </CardContent>
        </Card>

        {/* AI Behaviour */}
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
                <Input {...form.register('ai_daily_limit', { valueAsNumber: true })} type="number" min={1} max={200} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('agentAi.openerInstructions')}</Label>
              <Textarea
                {...form.register('ai_opener')}
                placeholder="e.g. Always mention their recent job change. Keep it under 200 chars. Don't pitch directly."
                rows={3}
              />
            </div>

            {/* Full-auto toggle */}
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
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                  fullAuto ? 'bg-blue-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    fullAuto ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Booking link */}
        <Card>
          <CardHeader>
            <CardTitle>{t('agentAi.bookingLink')}</CardTitle>
            <CardDescription>{t('agentAi.bookingLinkDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              {...form.register('calendar_link')}
              placeholder="https://calendly.com/yourname/30min"
              type="url"
            />
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
