import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as prospectsService from '@/modules/prospects/prospects.service'
import { CreateProspectSchema, ProspectFiltersSchema } from '@/modules/prospects/prospects.types'

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const rawFilters = {
      temperature: searchParams.get('temperature') ?? undefined,
      booking_status: searchParams.get('booking_status') ?? undefined,
      connection_status: searchParams.get('connection_status') ?? undefined,
      industry: searchParams.get('industry') ?? undefined,
      search: searchParams.get('search') ?? undefined,
    }
    const filters = ProspectFiltersSchema.parse(rawFilters)

    const prospects = await prospectsService.getAll(user.id, filters)
    return NextResponse.json(prospects)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message, code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const body: unknown = await req.json()
    const parsed = CreateProspectSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const prospect = await prospectsService.create(user.id, parsed.data)
    return NextResponse.json(prospect, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message, code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
