'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, Loader2, User, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useToast } from '@/hooks/use-toast'
import { useT } from '@/lib/i18n/context'

// ─── Profile ─────────────────────────────────────────────────────────────────

const ProfileFormSchema = z.object({
  full_name: z.string().optional(),
  phone: z.string().optional(),
  avatar_url: z.string().url().or(z.literal('')).optional(),
})
type ProfileForm = z.infer<typeof ProfileFormSchema>

// ─── Business settings ────────────────────────────────────────────────────────

const OfferSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Title required'),
  description: z.string(),
  price: z.string().optional(),
})

const SettingsFormSchema = z.object({
  business_name: z.string().optional(),
  business_description: z.string().optional(),
  business_model: z.string().optional(),
  offers: z.array(OfferSchema),
  main_features: z.array(z.object({ value: z.string() })),
})

type SettingsForm = z.infer<typeof SettingsFormSchema>

export default function SettingsPage() {
  const t = useT()
  const { toast } = useToast()

  // ── Profile ──────────────────────────────────────────────────────────────
  const [email, setEmail] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(ProfileFormSchema),
    defaultValues: { full_name: '', phone: '', avatar_url: '' },
  })

  const avatarUrl = profileForm.watch('avatar_url')
  const fullName = profileForm.watch('full_name')

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((data) => {
        if (!data || data.error) return
        setEmail(data.email ?? '')
        profileForm.reset({
          full_name: data.full_name ?? '',
          phone: data.phone ?? '',
          avatar_url: data.avatar_url ?? '',
        })
      })
      .catch(() => {})
  }, [profileForm])

  async function saveProfile(values: ProfileForm): Promise<void> {
    setProfileSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (res.ok) {
        toast({ title: t('settings.savedProfile') })
        profileForm.reset(values)
      } else {
        toast({ title: t('common.saveFailed'), variant: 'destructive' })
      }
    } catch {
      toast({ title: t('common.networkError'), variant: 'destructive' })
    } finally {
      setProfileSaving(false)
    }
  }

  // ── Business settings ────────────────────────────────────────────────────
  const [bizSaving, setBizSaving] = useState(false)

  const form = useForm<SettingsForm>({
    resolver: zodResolver(SettingsFormSchema),
    defaultValues: {
      business_name: '',
      business_description: '',
      business_model: '',
      offers: [],
      main_features: [],
    },
  })

  const { fields: offerFields, append: appendOffer, remove: removeOffer } = useFieldArray({
    control: form.control,
    name: 'offers',
  })

  const { fields: featureFields, append: appendFeature, remove: removeFeature } = useFieldArray({
    control: form.control,
    name: 'main_features',
  })

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        if (!data || data.error) return
        form.reset({
          business_name: data.business_name ?? '',
          business_description: data.business_description ?? '',
          business_model: data.business_model ?? '',
          offers: Array.isArray(data.offers) ? data.offers : [],
          main_features: Array.isArray(data.main_features)
            ? data.main_features.map((v: string) => ({ value: v }))
            : [],
        })
      })
      .catch(() => {})
  }, [form])

  const saveSettings = useCallback(async (values: SettingsForm): Promise<void> => {
    setBizSaving(true)
    try {
      // Only send the business fields managed by this form.
      // Thanks to the partial upsert in the repository, ai_behavior,
      // target_persona and calendar_link are never overwritten.
      const body = {
        business_name: values.business_name || null,
        business_description: values.business_description || null,
        business_model: values.business_model || null,
        offers: values.offers,
        main_features: values.main_features.map((f) => f.value).filter(Boolean),
      }
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast({ title: t('common.saved'), description: t('settings.businessSavedDesc') })
        form.reset(values)
      } else {
        const errData = await res.json().catch(() => ({}))
        const detail =
          errData?.code === 'VALIDATION_ERROR'
            ? t('settings.validationError')
            : errData?.error ?? t('common.saveFailed')
        toast({ title: t('common.saveFailed'), description: detail, variant: 'destructive' })
      }
    } catch {
      toast({ title: t('common.networkError'), variant: 'destructive' })
    } finally {
      setBizSaving(false)
    }
  }, [form, toast, t])

  const isDirty = form.formState.isDirty

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{t('settings.title')}</h1>
        <p className="text-slate-500 text-sm mt-1">{t('settings.subtitle')}</p>
      </div>

      {/* ── Profile ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-4 w-4" />
            {t('settings.profile')}
          </CardTitle>
          <CardDescription>{t('settings.profileDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={profileForm.handleSubmit(saveProfile)} className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={avatarUrl ?? ''} alt={fullName ?? 'Profile'} />
                <AvatarFallback className="bg-blue-100 text-blue-700 text-lg font-semibold">
                  {fullName?.charAt(0)?.toUpperCase() ?? email?.charAt(0)?.toUpperCase() ?? '?'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <Label>{t('settings.photoUrl')}</Label>
                <Input
                  {...profileForm.register('avatar_url')}
                  placeholder="https://example.com/photo.jpg"
                  type="url"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('settings.fullName')}</Label>
                <Input {...profileForm.register('full_name')} placeholder="Jane Doe" autoComplete="name" />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.phone')}</Label>
                <Input {...profileForm.register('phone')} placeholder="+33 6 00 00 00 00" type="tel" autoComplete="tel" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('settings.email')}</Label>
              <Input value={email} disabled className="bg-slate-50 text-slate-500" />
              <p className="text-xs text-slate-400">{t('settings.emailNote')}</p>
            </div>

            <Button type="submit" disabled={profileSaving}>
              {profileSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {profileSaving ? t('common.saving') : t('settings.saveProfile')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ── Business settings ── */}
      <form onSubmit={form.handleSubmit(saveSettings)}>
        {/* Business Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('settings.businessInfo')}</CardTitle>
            <CardDescription>{t('settings.businessInfoDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('settings.businessName')}</Label>
                <Input {...form.register('business_name')} placeholder="Acme Corp" />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.businessModel')}</Label>
                <Input {...form.register('business_model')} placeholder={t('settings.businessModelPlaceholder')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('settings.businessDescription')}</Label>
              <Textarea {...form.register('business_description')} placeholder={t('settings.businessDescPlaceholder')} rows={4} />
            </div>
          </CardContent>
        </Card>

        {/* Offers */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('settings.offers')}</CardTitle>
            <CardDescription>{t('settings.offersDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {offerFields.map((field, idx) => (
              <div key={field.id} className="flex gap-3 items-start border rounded-md p-3 bg-slate-50">
                <div className="flex-1 space-y-2">
                  <Input {...form.register(`offers.${idx}.title`)} placeholder={t('settings.offerTitle')} />
                  {form.formState.errors.offers?.[idx]?.title && (
                    <p className="text-xs text-red-500">{form.formState.errors.offers[idx]?.title?.message}</p>
                  )}
                  <Textarea {...form.register(`offers.${idx}.description`)} placeholder={t('settings.offerDescription')} rows={2} />
                  <Input {...form.register(`offers.${idx}.price`)} placeholder={t('settings.offerPrice')} />
                </div>
                <Button type="button" variant="ghost" size="icon" className="text-red-500 hover:text-red-600" onClick={() => removeOffer(idx)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => appendOffer({ id: crypto.randomUUID(), title: '', description: '', price: '' })}>
              <Plus className="h-4 w-4 mr-1" /> {t('settings.addOffer')}
            </Button>
          </CardContent>
        </Card>

        {/* Main Features */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('settings.mainFeatures')}</CardTitle>
            <CardDescription>{t('settings.mainFeaturesDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {featureFields.map((field, idx) => (
                <Badge key={field.id} variant="secondary" className="flex items-center gap-1 pr-1">
                  <Input
                    {...form.register(`main_features.${idx}.value`)}
                    className="h-5 border-none bg-transparent p-0 text-xs w-24 focus-visible:ring-0"
                    placeholder="Feature…"
                  />
                  <button type="button" onClick={() => removeFeature(idx)} className="text-slate-400 hover:text-slate-700">×</button>
                </Badge>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => appendFeature({ value: '' })}>
              <Plus className="h-4 w-4 mr-1" /> {t('settings.addFeature')}
            </Button>
          </CardContent>
        </Card>

        {/* Sticky save bar — slides up when there are unsaved changes */}
        <div
          className={`sticky bottom-4 z-10 transition-all duration-300 ${
            isDirty ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
          }`}
        >
          <div className="flex items-center justify-between rounded-xl border bg-white px-5 py-3 shadow-lg">
            <span className="text-sm text-slate-500">{t('settings.unsavedChanges')}</span>
            <Button type="submit" disabled={bizSaving} className="gap-2 min-w-[130px]">
              {bizSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {bizSaving ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
