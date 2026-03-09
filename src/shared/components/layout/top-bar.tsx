'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { LogOut, User, Globe } from 'lucide-react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { useLanguage, useT } from '@/lib/i18n/context'
import type { Lang } from '@/lib/i18n/translations'

interface TopBarProps {
  userEmail?: string
}

export function TopBar({ userEmail }: TopBarProps) {
  const router = useRouter()
  const t = useT()
  const { lang, setLang } = useLanguage()

  async function handleSignOut(): Promise<void> {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = userEmail
    ? userEmail.slice(0, 2).toUpperCase()
    : '??'

  const otherLang: Lang = lang === 'fr' ? 'en' : 'fr'
  const langLabel = lang === 'fr' ? 'EN' : 'FR'

  return (
    <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-end gap-3 px-6">
      {/* Language switcher */}
      <button
        onClick={() => setLang(otherLang)}
        className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 border border-slate-200 rounded-md px-2 py-1 hover:bg-slate-50 transition-colors"
        title={lang === 'fr' ? 'Switch to English' : 'Passer en français'}
      >
        <Globe className="h-3.5 w-3.5" />
        {langLabel}
      </button>

      {/* User menu */}
      <DropdownMenuPrimitive.Root>
        <DropdownMenuPrimitive.Trigger asChild>
          <button className="rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-slate-900">
            <Avatar className="h-8 w-8 cursor-pointer">
              <AvatarFallback className="bg-blue-500 text-white text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuPrimitive.Trigger>

        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.Content
            align="end"
            sideOffset={8}
            className="z-50 min-w-[160px] rounded-md border border-slate-200 bg-white p-1 shadow-md text-sm"
          >
            {userEmail && (
              <>
                <div className="flex items-center gap-2 px-2 py-1.5 text-slate-500">
                  <User className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[140px]">{userEmail}</span>
                </div>
                <DropdownMenuPrimitive.Separator className="my-1 h-px bg-slate-100" />
              </>
            )}
            <DropdownMenuPrimitive.Item
              onSelect={handleSignOut}
              className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-red-600 hover:bg-red-50 outline-none"
            >
              <LogOut className="h-3.5 w-3.5" />
              {t('topbar.signOut')}
            </DropdownMenuPrimitive.Item>
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenuPrimitive.Root>
    </header>
  )
}
