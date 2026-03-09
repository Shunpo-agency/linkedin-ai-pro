import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import {
  CAMPAIGN_SETUP_SYSTEM,
  buildCampaignSetupPrompt,
  type CampaignSetupResult,
} from '@/core/ai/prompts/campaign-setup.prompt'

const BodySchema = z.object({
  url: z.string().url().optional(),
  description: z.string().min(10).max(2000).optional(),
}).refine((d) => d.url || d.description, {
  message: 'Provide at least a URL or a description',
})

async function fetchWebsiteText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ShunpoBot/1.0)' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const html = await res.text()
    // Strip HTML tags and collapse whitespace
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 4000)
  } catch {
    return null
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
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message, code: 'VALIDATION_ERROR' },
        { status: 400 },
      )
    }

    const { url, description } = parsed.data

    // Try to fetch website content if URL provided
    let websiteContent: string | null = null
    if (url) {
      websiteContent = await fetchWebsiteText(url)
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
    const prompt = buildCampaignSetupPrompt({ description, websiteContent: websiteContent ?? undefined, url })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: CAMPAIGN_SETUP_SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    })

    const block = response.content[0]
    if (!block || block.type !== 'text') {
      throw new Error('Unexpected Claude response format')
    }

    // Strip markdown code fences if Claude wrapped the JSON (```json ... ```)
    const raw = block.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')

    let result: CampaignSetupResult
    try {
      result = JSON.parse(raw) as CampaignSetupResult
    } catch {
      throw new Error('Claude returned invalid JSON')
    }

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message, code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
