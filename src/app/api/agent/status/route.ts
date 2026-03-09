import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const { data: runningRuns } = await supabase
      .from('agent_runs')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'running')
      .limit(1)

    const { data: recentRuns } = await supabase
      .from('agent_runs')
      .select('id, intent_type, status, started_at, completed_at, error')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(20)

    return NextResponse.json({
      isRunning: (runningRuns?.length ?? 0) > 0,
      recentRuns: recentRuns ?? [],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message, code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
