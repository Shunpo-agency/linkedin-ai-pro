'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Search, SlidersHorizontal } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { timeAgo } from '@/shared/utils/date'
import { initials, fullName } from '@/shared/utils/formatting'
import { useT } from '@/lib/i18n/context'

interface Prospect {
  id: string
  first_name: string | null
  last_name: string | null
  job_title: string | null
  company: string | null
  industry: string | null
  temperature: string
  connection_status: string
  booking_status: string
  lead_score: number
  profile_picture_url: string | null
  updated_at: string
}

const TEMP_COLORS: Record<string, string> = {
  cold: 'bg-blue-100 text-blue-700',
  warm: 'bg-orange-100 text-orange-700',
  hot: 'bg-red-100 text-red-700',
}

const BOOKING_COLORS: Record<string, string> = {
  none: 'bg-slate-100 text-slate-600',
  link_sent: 'bg-purple-100 text-purple-700',
  booked: 'bg-green-100 text-green-700',
}

export default function ProspectsPage() {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const temperature = searchParams.get('temperature') ?? ''
  const bookingStatus = searchParams.get('booking_status') ?? ''
  const connectionStatus = searchParams.get('connection_status') ?? ''

  const fetchProspects = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (temperature) params.set('temperature', temperature)
    if (bookingStatus) params.set('booking_status', bookingStatus)
    if (connectionStatus) params.set('connection_status', connectionStatus)

    try {
      const res = await fetch(`/api/prospects?${params.toString()}`)
      const data = await res.json()
      setProspects(Array.isArray(data) ? data : [])
    } catch {
      setProspects([])
    } finally {
      setLoading(false)
    }
  }, [search, temperature, bookingStatus, connectionStatus])

  useEffect(() => {
    const timer = setTimeout(fetchProspects, 300)
    return () => clearTimeout(timer)
  }, [fetchProspects])

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all') {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`/prospects?${params.toString()}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('prospects.title')}</h1>
          <p className="text-slate-500 text-sm mt-1">{prospects.length} leads</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9 w-64"
            placeholder={t('prospects.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={temperature || 'all'} onValueChange={(v) => setFilter('temperature', v)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder={t('prospects.temperature')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            <SelectItem value="cold">{t('prospects.cold')}</SelectItem>
            <SelectItem value="warm">{t('prospects.warm')}</SelectItem>
            <SelectItem value="hot">{t('prospects.hot')}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={bookingStatus || 'all'} onValueChange={(v) => setFilter('booking_status', v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t('prospects.booking')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            <SelectItem value="none">{t('prospects.none')}</SelectItem>
            <SelectItem value="link_sent">{t('prospects.linkSent')}</SelectItem>
            <SelectItem value="booked">{t('prospects.scheduled')}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={connectionStatus || 'all'}
          onValueChange={(v) => setFilter('connection_status', v)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder={t('prospects.connection')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            <SelectItem value="not_connected">{t('prospects.notConnected')}</SelectItem>
            <SelectItem value="pending">{t('prospects.invited')}</SelectItem>
            <SelectItem value="connected">{t('prospects.connected')}</SelectItem>
          </SelectContent>
        </Select>

        {(temperature || bookingStatus || connectionStatus) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/prospects')}
            className="text-slate-500"
          >
            {t('common.back')}
          </Button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : prospects.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <SlidersHorizontal className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p>{t('prospects.noProspects')}</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>{t('prospects.name')}</TableHead>
                <TableHead>{t('prospects.company')}</TableHead>
                <TableHead>{t('prospects.temperature')}</TableHead>
                <TableHead>{t('prospects.score')}</TableHead>
                <TableHead>{t('prospects.connection')}</TableHead>
                <TableHead>{t('prospects.booking')}</TableHead>
                <TableHead>{t('prospects.lastMessage')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prospects.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => router.push(`/prospects/${p.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-slate-200 text-slate-600 text-xs">
                          {initials(p.first_name, p.last_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{fullName(p.first_name, p.last_name)}</p>
                        <p className="text-xs text-slate-500">{p.job_title ?? '—'}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">{p.company ?? '—'}</TableCell>
                  <TableCell>
                    <Badge className={TEMP_COLORS[p.temperature] ?? ''} variant="secondary">
                      {p.temperature}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 rounded-full bg-slate-200">
                        <div
                          className="h-1.5 rounded-full bg-blue-500"
                          style={{ width: `${p.lead_score}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500">{p.lead_score}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-xs">
                      {p.connection_status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={BOOKING_COLORS[p.booking_status] ?? ''} variant="secondary">
                      {p.booking_status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">{timeAgo(p.updated_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
