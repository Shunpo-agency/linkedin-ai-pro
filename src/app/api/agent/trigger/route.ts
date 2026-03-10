import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prospectDiscoveryQueue } from '@/workers/queues'

export async function POST(): Promise<NextResponse> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    // Déclenche immédiatement un job de découverte (sans jitter)
    const job = await prospectDiscoveryQueue.add(
      'manual-trigger',
      { userId: user.id, skipJitter: true },
      { priority: 1 }, // priorité haute
    )

    console.log(`[trigger] Manual discovery job ${job.id} queued for user ${user.id}`)

    return NextResponse.json({ jobId: job.id, message: 'Découverte lancée' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message, code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
