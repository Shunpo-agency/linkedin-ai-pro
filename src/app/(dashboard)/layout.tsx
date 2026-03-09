import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/shared/components/layout/sidebar'
import { TopBar } from '@/shared/components/layout/top-bar'
import { Toaster } from '@/components/ui/toaster'

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if there is a running agent for the status indicator
  const { data: runningAgent } = await supabase
    .from('agent_runs')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'running')
    .limit(1)

  const agentRunning = (runningAgent?.length ?? 0) > 0

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar agentRunning={agentRunning} />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar userEmail={user.email} />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
      <Toaster />
    </div>
  )
}
