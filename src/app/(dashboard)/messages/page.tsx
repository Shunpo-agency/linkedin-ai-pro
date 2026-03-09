'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, MessageSquare, Bot, ArrowUpRight } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { timeAgo } from '@/shared/utils/date'
import { initials, fullName } from '@/shared/utils/formatting'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/i18n/context'

interface MessageWithProspect {
  id: string
  direction: 'inbound' | 'outbound'
  content: string
  sent_at: string
  ai_generated: boolean
  prospect: {
    id: string
    first_name: string | null
    last_name: string | null
    job_title: string | null
    company: string | null
    temperature: string
  }
}

export default function MessagesPage() {
  const t = useT()
  const router = useRouter()
  const [messages, setMessages] = useState<MessageWithProspect[]>([])
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchMessages()

    const supabase = createClient()
    const channel = supabase
      .channel('messages-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => { fetchMessages() },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function fetchMessages(): Promise<void> {
    try {
      const res = await fetch('/api/messages?limit=100')
      const data = await res.json()
      setMessages(Array.isArray(data) ? data : [])
    } catch {
      setMessages([])
    } finally {
      setLoading(false)
    }
  }

  // Group by prospect
  const grouped = messages.reduce<Record<string, MessageWithProspect[]>>((acc, msg) => {
    const key = msg.prospect.id
    if (!acc[key]) acc[key] = []
    acc[key].push(msg)
    return acc
  }, {})

  const prospectGroups = Object.entries(grouped).sort(([, a], [, b]) => {
    const lastA = a[a.length - 1]?.sent_at ?? ''
    const lastB = b[b.length - 1]?.sent_at ?? ''
    return lastB.localeCompare(lastA)
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('messages.title')}</h1>
        <p className="text-slate-500 text-sm mt-1">{t('messages.subtitle')}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : prospectGroups.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <MessageSquare className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p>{t('messages.noMessages')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {prospectGroups.map(([prospectId, msgs]) => {
            const p = msgs[0].prospect
            const lastMsg = msgs[msgs.length - 1]
            const hasInbound = msgs.some((m) => m.direction === 'inbound')

            return (
              <Card key={prospectId} className="overflow-hidden">
                {/* Prospect header */}
                <div
                  className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => router.push(`/prospects/${prospectId}`)}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-slate-200">
                        {initials(p.first_name, p.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <span className="font-medium text-sm">
                        {fullName(p.first_name, p.last_name)}
                      </span>
                      <span className="text-slate-400 text-sm"> · </span>
                      <span className="text-slate-500 text-sm">{p.company ?? '—'}</span>
                    </div>
                    {hasInbound && (
                      <Badge className="bg-green-100 text-green-700" variant="secondary">
                        {t('messages.replied')}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{timeAgo(lastMsg.sent_at)}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </div>

                {/* Messages */}
                <div className="p-4 space-y-3 max-h-72 overflow-y-auto">
                  {msgs.map((msg, idx) => (
                    <div key={msg.id}>
                      <div className={`flex gap-2 ${msg.direction === 'outbound' ? 'flex-row-reverse' : ''}`}>
                        <div
                          className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                            msg.direction === 'outbound'
                              ? 'bg-blue-500 text-white'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {msg.content}
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
                      {idx < msgs.length - 1 && <div className="my-1" />}
                    </div>
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
