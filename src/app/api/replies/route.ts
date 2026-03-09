import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as suggestedRepliesService from '@/modules/suggested-replies/suggested-replies.service'

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const replies = await suggestedRepliesService.getPendingReplies(user.id)
    return NextResponse.json(replies)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message, code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
