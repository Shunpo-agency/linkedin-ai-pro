import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()
    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name ?? '',
      phone: user.user_metadata?.phone ?? '',
      avatar_url: user.user_metadata?.avatar_url ?? '',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json()) as {
      full_name?: string
      phone?: string
      avatar_url?: string
    }

    const { data, error } = await supabase.auth.updateUser({
      data: {
        full_name: body.full_name ?? user.user_metadata?.full_name ?? '',
        phone: body.phone ?? user.user_metadata?.phone ?? '',
        avatar_url: body.avatar_url ?? user.user_metadata?.avatar_url ?? '',
      },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      id: data.user.id,
      email: data.user.email,
      full_name: data.user.user_metadata?.full_name ?? '',
      phone: data.user.user_metadata?.phone ?? '',
      avatar_url: data.user.user_metadata?.avatar_url ?? '',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
