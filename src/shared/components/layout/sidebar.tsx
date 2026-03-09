'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Megaphone,
  Settings,
  Linkedin,
  Bot,
  InboxIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/context'

interface SidebarProps {
  agentRunning?: boolean
}

export function Sidebar({ agentRunning = false }: SidebarProps) {
  const pathname = usePathname()
  const t = useT()
  const [pendingReplies, setPendingReplies] = useState(0)

  // Poll pending reply count every 30 s
  useEffect(() => {
    async function fetchCount(): Promise<void> {
      try {
        const res = await fetch('/api/replies/count')
        const data = await res.json()
        setPendingReplies(typeof data?.count === 'number' ? data.count : 0)
      } catch {
        // ignore
      }
    }
    fetchCount()
    const id = setInterval(fetchCount, 30_000)
    return () => clearInterval(id)
  }, [])

  const NAV_ITEMS = [
    { href: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard, badge: undefined as number | undefined },
    { href: '/prospects', label: t('nav.prospects'), icon: Users, badge: undefined },
    { href: '/messages', label: t('nav.messages'), icon: MessageSquare, badge: undefined },
    {
      href: '/replies',
      label: t('nav.replies'),
      icon: InboxIcon,
      badge: pendingReplies > 0 ? pendingReplies : undefined,
    },
    { href: '/campaigns', label: t('nav.campaigns'), icon: Megaphone, badge: undefined },
    { href: '/agent-ai', label: t('nav.agentAi'), icon: Bot, badge: undefined },
    { href: '/linkedin', label: t('nav.linkedin'), icon: Linkedin, badge: undefined },
    { href: '/settings', label: t('nav.settings'), icon: Settings, badge: undefined },
  ]

  return (
    <aside className="flex flex-col w-60 min-h-screen bg-slate-900 text-slate-100 px-3 py-4">
      {/* Brand */}
      <div className="flex items-center gap-2 px-3 mb-8">
        <Bot className="h-6 w-6 text-blue-400" />
        <span className="font-semibold text-base tracking-tight">LinkedIn AI Pro</span>
      </div>

      {/* Agent status */}
      <div className="flex items-center gap-2 px-3 mb-6">
        <span
          className={cn(
            'h-2 w-2 rounded-full',
            agentRunning ? 'bg-green-400 animate-pulse' : 'bg-slate-500',
          )}
        />
        <span className="text-xs text-slate-400">
          {agentRunning ? t('agent.running') : t('agent.idle')}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon, badge }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {badge !== undefined && (
                <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-blue-500 px-1.5 text-xs font-semibold text-white">
                  {badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
