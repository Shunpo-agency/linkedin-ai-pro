import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import * as messagesService from '@/modules/messages/messages.service'

const CreateMessageSchema = z.object({
  prospect_id: z.string().uuid(),
  content: z.string().min(1).max(2000),
  direction: z.enum(['outbound', 'inbound']).default('outbound'),
  ai_generated: z.boolean().default(false),
})

const ListQuerySchema = z.object({
  prospect_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
})

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
    const { prospect_id, limit } = ListQuerySchema.parse({
      prospect_id: searchParams.get('prospect_id') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })

    const messages = await messagesService.getAll(user.id, { prospect_id, limit })
    return NextResponse.json(messages)
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
    const parsed = CreateMessageSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const msg = await messagesService.create(user.id, {
      ...parsed.data,
      channel: 'linkedin',
      unipile_message_id: null,
      sent_at: new Date().toISOString(),
      read_at: null,
    })
    return NextResponse.json(msg, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message, code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
