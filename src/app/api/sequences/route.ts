import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { generateSequenceQueue } from '@/workers/queues'

const TriggerSchema = z.object({
  prospect_id: z.string().uuid(),
  campaign_id: z.string().uuid().optional(),
})

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const prospectId = searchParams.get('prospect_id')
    const status = searchParams.get('status')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('message_sequences')
      .select('*')
      .eq('user_id', user.id)
      .order('step', { ascending: true })

    if (prospectId) query = query.eq('prospect_id', prospectId)
    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw new Error(error.message)

    return NextResponse.json(data ?? [])
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message, code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = TriggerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message, code: 'VALIDATION_ERROR' }, { status: 400 })
    }
    const { prospect_id, campaign_id } = parsed.data

    // Verify ownership
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: prospect } = await (supabase as any)
      .from('prospects')
      .select('id')
      .eq('id', prospect_id)
      .eq('user_id', user.id)
      .single()

    if (!prospect) {
      return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    // Cancel any existing pending sequences for this prospect first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('message_sequences')
      .update({ status: 'skipped' })
      .eq('prospect_id', prospect_id)
      .eq('user_id', user.id)
      .eq('status', 'pending')

    // Queue generation job
    const job = await generateSequenceQueue.add('generate-sequence', {
      userId: user.id,
      prospectId: prospect_id,
      campaignId: campaign_id,
    })

    return NextResponse.json({ jobId: job.id, message: 'Sequence generation queued' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message, code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
