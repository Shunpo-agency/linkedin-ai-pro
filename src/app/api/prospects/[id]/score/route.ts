import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { leadScorerQueue } from '@/workers/queues'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    // Verify ownership
    const { data: prospect } = await supabase
      .from('prospects')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (!prospect) {
      return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    // Queue lead scoring job
    const job = await leadScorerQueue.add('score-lead', {
      userId: user.id,
      prospectId: params.id,
    })

    return NextResponse.json({ jobId: job.id, message: 'Scoring job queued' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message, code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('prospects')
      .select('lead_score, score_breakdown, score_updated_at, temperature, profile_analysis, ai_notes')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    return NextResponse.json(data ?? {})
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message, code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
