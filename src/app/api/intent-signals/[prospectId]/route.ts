import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as intentSignalsRepo from '@/modules/intent-signals/intent-signals.repository'

export async function GET(
  _req: NextRequest,
  { params }: { params: { prospectId: string } },
): Promise<NextResponse> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const signals = await intentSignalsRepo.getByProspect(user.id, params.prospectId)
    const totalScore = signals.reduce((sum, s) => sum + s.points, 0)
    return NextResponse.json({ signals, totalScore })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message, code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
