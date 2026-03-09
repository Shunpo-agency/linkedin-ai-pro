import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getHostedAuthUrl } from '@/core/linkedin/unipile.client'

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/linkedin/callback`
    const url = await getHostedAuthUrl(redirectUrl)
    return NextResponse.json({ url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message, code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
