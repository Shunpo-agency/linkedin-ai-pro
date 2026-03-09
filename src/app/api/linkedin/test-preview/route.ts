import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getLinkedInProfile } from '@/core/linkedin/unipile.client'
import { generateLinkedInMessage } from '@/core/ai/claude.client'
import type { MessageGenParams } from '@/core/ai/claude.client'

const TestPreviewSchema = z.object({
  linkedinUrl: z.string().url(),
})

function extractSlug(url: string): string | null {
  const match = url.match(/linkedin\.com\/in\/([^/?#]+)/i)
  return match ? match[1].replace(/\/$/, '') : null
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: unknown = await req.json()
    const parsed = TestPreviewSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const slug = extractSlug(parsed.data.linkedinUrl)
    if (!slug) {
      return NextResponse.json(
        { error: 'Invalid LinkedIn URL. Expected: https://www.linkedin.com/in/username' },
        { status: 400 },
      )
    }

    // Get the user's connected LinkedIn account
    const { data: account } = await supabase
      .from('linkedin_accounts')
      .select('unipile_account_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (!account) {
      return NextResponse.json(
        { error: 'No active LinkedIn account connected. Go to LinkedIn page to connect.' },
        { status: 400 },
      )
    }

    // Fetch LinkedIn profile via Unipile
    const profile = await getLinkedInProfile(account.unipile_account_id, slug)

    // Fetch business settings for AI context
    const serviceSupabase = createServiceClient()
    const { data: settings } = await serviceSupabase
      .from('business_settings')
      .select('business_description, offers')
      .eq('user_id', user.id)
      .maybeSingle()

    const offersRaw = Array.isArray(settings?.offers) ? (settings!.offers as unknown[]) : []

    // Build a job title from the headline (best we can from Unipile)
    const jobTitle = profile.headline ?? null

    // ── Upsert prospect to DB ──────────────────────────────────────────────────
    const normalizedUrl = `https://www.linkedin.com/in/${slug}/`
    const now = new Date().toISOString()

    // Check if prospect already exists for this user
    const { data: existing } = await serviceSupabase
      .from('prospects')
      .select('id')
      .eq('user_id', user.id)
      .eq('linkedin_profile_url', normalizedUrl)
      .maybeSingle()

    let prospectId: string

    if (existing) {
      // Update existing prospect with fresh profile data
      await serviceSupabase
        .from('prospects')
        .update({
          linkedin_id: profile.providerId ?? null,
          first_name: profile.firstName,
          last_name: profile.lastName,
          job_title: jobTitle,
          company: profile.company ?? null,
          profile_picture_url: profile.profilePictureUrl ?? null,
          updated_at: now,
        })
        .eq('id', existing.id)
      prospectId = existing.id
    } else {
      // Insert new prospect
      const { data: newProspect, error: insertError } = await serviceSupabase
        .from('prospects')
        .insert({
          user_id: user.id,
          linkedin_profile_url: normalizedUrl,
          linkedin_id: profile.providerId ?? null,
          first_name: profile.firstName,
          last_name: profile.lastName,
          job_title: jobTitle,
          company: profile.company ?? null,
          profile_picture_url: profile.profilePictureUrl ?? null,
          connection_status: 'not_connected',
          source: 'test',
          created_at: now,
          updated_at: now,
        })
        .select('id')
        .single()

      if (insertError || !newProspect) {
        throw new Error(`Failed to create prospect: ${insertError?.message ?? 'unknown'}`)
      }
      prospectId = newProspect.id
    }

    // ── Generate AI message ────────────────────────────────────────────────────
    const params: MessageGenParams = {
      businessDescription: settings?.business_description ?? '',
      offers: offersRaw,
      prospect: {
        firstName: profile.firstName,
        lastName: profile.lastName,
        jobTitle,
        company: profile.company,
        industry: null,
        location: null,
      },
    }

    const generatedMessage = await generateLinkedInMessage(params)

    return NextResponse.json({
      prospectId,
      providerId: profile.providerId,
      profile: {
        firstName: profile.firstName,
        lastName: profile.lastName,
        headline: profile.headline,
        company: profile.company,
        profilePictureUrl: profile.profilePictureUrl,
      },
      generatedMessage,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
