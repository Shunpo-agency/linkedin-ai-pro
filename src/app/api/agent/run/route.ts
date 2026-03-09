import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { resolveIntent } from '@/core/agent/orchestrator'
import type { AgentIntent } from '@/core/agent/intents/types'
import { generateAndQueueMessage } from '@/core/agent/actions/ai.actions'

const RunIntentSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('FIND_PROSPECTS'),
    payload: z.object({
      persona: z.object({
        roles: z.array(z.string()),
        industries: z.array(z.string()),
        companySizes: z.array(z.string()),
        locations: z.array(z.string()),
        keywords: z.array(z.string()),
      }),
      limit: z.number().int().min(1).max(100).default(10),
      excludeLinkedInIds: z.array(z.string()).default([]),
    }),
  }),
  z.object({
    type: z.literal('SEND_CONNECTION_REQUEST'),
    payload: z.object({
      prospectId: z.string().uuid(),
      personalizedNote: z.string().max(300),
    }),
  }),
  z.object({
    type: z.literal('SEND_MESSAGE'),
    payload: z.object({
      prospectId: z.string().uuid(),
      content: z.string().max(2000).optional(),
      channel: z.literal('linkedin').default('linkedin'),
    }),
  }),
  z.object({
    type: z.literal('FOLLOW_UP'),
    payload: z.object({
      prospectId: z.string().uuid(),
      daysSinceLastMessage: z.number().int().min(0).default(3),
    }),
  }),
  z.object({
    type: z.literal('SCORE_LEAD'),
    payload: z.object({
      prospectId: z.string().uuid(),
      conversationHistory: z.array(z.object({
        id: z.string(),
        direction: z.enum(['inbound', 'outbound']),
        content: z.string(),
        sentAt: z.string(),
      })).default([]),
    }),
  }),
  z.object({
    type: z.literal('BOOK_MEETING'),
    payload: z.object({
      prospectId: z.string().uuid(),
    }),
  }),
  z.object({
    type: z.literal('REFINE_PERSONA'),
    payload: z.object({
      currentPersona: z.object({
        roles: z.array(z.string()),
        industries: z.array(z.string()),
        companySizes: z.array(z.string()),
        locations: z.array(z.string()),
        keywords: z.array(z.string()),
      }),
      performanceData: z.object({
        totalProspects: z.number(),
        messagesSent: z.number(),
        repliesCount: z.number(),
        meetingsBooked: z.number(),
        replyRate: z.number(),
      }),
    }),
  }),
])

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
    const parsed = RunIntentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.issues },
        { status: 400 },
      )
    }

    // Special case: SEND_MESSAGE without content → generate it first
    if (parsed.data.type === 'SEND_MESSAGE' && !parsed.data.payload.content) {
      const generatedContent = await generateAndQueueMessage(user.id, parsed.data.payload.prospectId)
      return NextResponse.json({ generatedContent })
    }

    const result = await resolveIntent(parsed.data as AgentIntent, user.id)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message, code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
