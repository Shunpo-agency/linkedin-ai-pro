'use client'

import { useEffect, useState } from 'react'
import { Linkedin, CheckCircle2, AlertCircle, Loader2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { useT } from '@/lib/i18n/context'

interface LinkedInAccount {
  id: string
  linkedin_name: string | null
  linkedin_profile_url: string | null
  status: string
  connected_at: string
  unipile_account_id: string
}

export default function LinkedInPage() {
  const t = useT()
  const [account, setAccount] = useState<LinkedInAccount | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('connected') === 'true') {
      window.history.replaceState({}, '', '/linkedin')
    }
    if (params.get('error')) {
      setError(decodeURIComponent(params.get('error') ?? 'Connection failed'))
      window.history.replaceState({}, '', '/linkedin')
    }

    fetchAccount()
  }, [])

  async function fetchAccount(): Promise<void> {
    setLoading(true)
    try {
      const res = await fetch('/api/linkedin/account')
      const data = await res.json()
      if (data && !data.error) {
        setAccount(data)
      }
    } catch {
      // no account yet
    } finally {
      setLoading(false)
    }
  }

  async function handleConnect(): Promise<void> {
    setConnecting(true)
    setError(null)
    try {
      const res = await fetch('/api/linkedin/auth')
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error ?? 'Failed to start connection')
        setConnecting(false)
      }
    } catch {
      setError('Failed to start connection')
      setConnecting(false)
    }
  }

  async function handleDisconnect(): Promise<void> {
    if (!account) return
    try {
      await fetch('/api/linkedin/account', { method: 'DELETE' })
      setAccount(null)
    } catch {
      setError('Failed to disconnect')
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('linkedin.title')}</h1>
        <p className="text-slate-500 text-sm mt-1">{t('linkedin.subtitle')}</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </CardContent>
        </Card>
      ) : account ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Linkedin className="h-5 w-5 text-blue-600" />
                {t('linkedin.connectedAccount')}
              </CardTitle>
              <Badge
                variant={account.status === 'active' ? 'default' : 'secondary'}
                className={account.status === 'active' ? 'bg-green-100 text-green-700' : ''}
              >
                {account.status === 'active' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                {account.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">
                  {account.linkedin_name?.charAt(0).toUpperCase() ?? 'LI'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{account.linkedin_name ?? 'LinkedIn Account'}</p>
                {account.linkedin_profile_url && (
                  <a
                    href={account.linkedin_profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 flex items-center gap-1 hover:underline"
                  >
                    {t('linkedin.viewProfile')} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>

            <Separator />

            <div className="text-sm text-slate-500">
              {t('linkedin.connectedOn')}{' '}
              {new Date(account.connected_at).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </div>

            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={handleDisconnect}
              >
                {t('linkedin.disconnect')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Linkedin className="h-5 w-5 text-slate-400" />
              {t('linkedin.noAccount')}
            </CardTitle>
            <CardDescription>{t('linkedin.noAccountDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                {t('linkedin.feature1')}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                {t('linkedin.feature2')}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                {t('linkedin.feature3')}
              </li>
            </ul>
            <Button onClick={handleConnect} disabled={connecting}>
              {connecting ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />{t('linkedin.connecting')}</>
              ) : (
                <><Linkedin className="h-4 w-4 mr-2" />{t('linkedin.connectBtn')}</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="pt-4 text-sm text-amber-800">
          <strong>{t('linkedin.important')}</strong> {t('linkedin.disclaimer')}
        </CardContent>
      </Card>
    </div>
  )
}
