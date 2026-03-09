import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAccountInfo } from '@/core/linkedin/unipile.client'

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    const accountId = req.nextUrl.searchParams.get('account_id')
    if (!accountId) {
      return NextResponse.redirect(
        new URL('/linkedin?error=Missing+account_id', req.url),
      )
    }

    // Fetch account info from Unipile
    let accountInfo: { name: string; profileUrl: string; pictureUrl: string } | null = null
    try {
      accountInfo = await getAccountInfo(accountId)
    } catch {
      // Account info is optional — we can still save with just the ID
    }

    // Upsert the LinkedIn account record
    const { error } = await supabase.from('linkedin_accounts').upsert(
      {
        user_id: user.id,
        unipile_account_id: accountId,
        linkedin_name: accountInfo?.name ?? null,
        linkedin_profile_url: accountInfo?.profileUrl ?? null,
        status: 'active',
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'unipile_account_id' },
    )

    if (error) {
      console.error('linkedin/callback: failed to save account', error.message)
      return NextResponse.redirect(
        new URL(`/linkedin?error=${encodeURIComponent(error.message)}`, req.url),
      )
    }

    return NextResponse.redirect(new URL('/linkedin?connected=true', req.url))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.redirect(
      new URL(`/linkedin?error=${encodeURIComponent(message)}`, req.url),
    )
  }
}
