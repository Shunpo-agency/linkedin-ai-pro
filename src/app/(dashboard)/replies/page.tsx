'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Bot,
  CheckCircle2,
  XCircle,
  Edit3,
  Loader2,
  MessageSquare,
  ExternalLink,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { timeAgo } from '@/shared/utils/date'
import { initials, fullName } from '@/shared/utils/formatting'
import { useT } from '@/lib/i18n/context'
import type { SuggestedReplyWithProspect } from '@/modules/suggested-replies/suggested-replies.types'

type ActionState = 'idle' | 'sending' | 'done' | 'error'

interface ReplyCardProps {
  reply: SuggestedReplyWithProspect
  onDone: (id: string) => void
}

function ReplyCard({ reply, onDone }: ReplyCardProps) {
  const t = useT()
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(reply.suggested_content)
  const [actionState, setActionState] = useState<ActionState>('idle')

  async function handleApprove(): Promise<void> {
    setActionState('sending')
    try {
      const res = await fetch(`/api/replies/${reply.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ final_content: content }),
      })
      if (res.ok) {
        setActionState('done')
        setTimeout(() => onDone(reply.id), 600)
      } else {
        setActionState('error')
        setTimeout(() => setActionState('idle'), 2500)
      }
    } catch {
      setActionState('error')
      setTimeout(() => setActionState('idle'), 2500)
    }
  }

  async function handleIgnore(): Promise<void> {
    setActionState('sending')
    try {
      const res = await fetch(`/api/replies/${reply.id}/ignore`, { method: 'POST' })
      if (res.ok) {
        setActionState('done')
        setTimeout(() => onDone(reply.id), 400)
      } else {
        setActionState('error')
        setTimeout(() => setActionState('idle'), 2500)
      }
    } catch {
      setActionState('error')
      setTimeout(() => setActionState('idle'), 2500)
    }
  }

  const busy = actionState === 'sending'
  const done = actionState === 'done'

  return (
    <Card className={done ? 'opacity-50 scale-95 transition-all duration-300' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          {/* Prospect info */}
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-blue-100 text-blue-700 text-sm font-semibold">
                {initials(reply.prospect.first_name, reply.prospect.last_name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-sm">
                {fullName(reply.prospect.first_name, reply.prospect.last_name)}
              </p>
              <p className="text-xs text-slate-500">
                {[reply.prospect.job_title, reply.prospect.company].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="secondary" className="text-xs gap-1">
              <Bot className="h-3 w-3" />
              {t('replies.aiSuggestion')}
            </Badge>
            <span className="text-xs text-slate-400">{timeAgo(reply.created_at)}</span>
            <Link
              href={`/prospects/${reply.prospect_id}`}
              className="text-slate-400 hover:text-slate-700"
              title={t('replies.viewProspect')}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Original inbound message */}
        {reply.inbound_message && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5">
            <p className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {t('replies.theyWrote')}
            </p>
            <p className="text-sm text-slate-700">{reply.inbound_message.content}</p>
            <p className="text-xs text-slate-400 mt-1">{timeAgo(reply.inbound_message.sent_at)}</p>
          </div>
        )}

        <Separator />

        {/* AI suggestion / editable reply */}
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1">
            <Bot className="h-3 w-3 text-blue-500" />
            {t('replies.suggestedReply')}
          </p>
          {editing ? (
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="text-sm resize-none"
              autoFocus
            />
          ) : (
            <div
              className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5 text-sm text-slate-800 cursor-pointer hover:border-blue-300 transition-colors"
              onClick={() => setEditing(true)}
              title={t('replies.clickToEdit')}
            >
              {content}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          {editing ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(false)}
              disabled={busy}
              className="gap-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t('replies.doneEditing')}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
              disabled={busy || done}
              className="gap-1.5"
            >
              <Edit3 className="h-3.5 w-3.5" />
              {t('replies.edit')}
            </Button>
          )}

          <Button
            size="sm"
            onClick={handleApprove}
            disabled={busy || done || !content.trim()}
            className="gap-1.5 bg-green-600 hover:bg-green-700 text-white ml-auto"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : done ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            {done ? t('replies.sent') : t('replies.approveAndSend')}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleIgnore}
            disabled={busy || done}
            className="gap-1.5 text-slate-500 hover:text-red-600"
          >
            <XCircle className="h-3.5 w-3.5" />
            {t('replies.ignore')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function RepliesPage() {
  const t = useT()
  const [replies, setReplies] = useState<SuggestedReplyWithProspect[]>([])
  const [loading, setLoading] = useState(true)

  const loadReplies = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch('/api/replies')
      const data = await res.json()
      setReplies(Array.isArray(data) ? data : [])
    } catch {
      setReplies([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadReplies()
  }, [loadReplies])

  function handleDone(id: string): void {
    setReplies((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('replies.title')}</h1>
        <p className="text-slate-500 text-sm mt-1">{t('replies.subtitle')}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : replies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
            <CheckCircle2 className="h-10 w-10" />
            <p className="font-medium">{t('replies.allClear')}</p>
            <p className="text-sm">{t('replies.allClearDesc')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            {replies.length} {t('replies.pendingCount')}
          </p>
          {replies.map((reply) => (
            <ReplyCard key={reply.id} reply={reply} onDone={handleDone} />
          ))}
        </div>
      )}
    </div>
  )
}
