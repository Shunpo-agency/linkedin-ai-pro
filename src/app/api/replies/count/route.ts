import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as suggestedRepliesService from '@/modules/suggested-replies/suggested-replies.service'

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ count: 0 })
    }

    const count = await suggestedRepliesService.countPendingReplies(user.id)
    return NextResponse.json({ count })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}
