import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  resolveProviderId,
  sendConnectionRequest,
  sendNewDirectMessage,
} from '@/core/linkedin/unipile.client'

const TestProspectSchema = z.object({
  linkedinUrl: z.string().url(),
  note: z.string().max(300).optional(),
  /** true = direct message (already connected), false = connection request */
  sendMessage: z.boolean().default(false),
  /** Prospect DB id returned by the test-preview step — used to persist message */
  prospectId: z.string().uuid().optional(),
})

/** Extract the public identifier from a LinkedIn profile URL.
 *  e.g. https://www.linkedin.com/in/john-doe/ → "john-doe"
 */
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
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const body: unknown = await req.json()
    const parsed = TestProspectSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const { linkedinUrl, note, sendMessage, prospectId } = parsed.data

    const slug = extractSlug(linkedinUrl)
    if (!slug) {
      return NextResponse.json(
        { error: 'Invalid LinkedIn URL. Expected format: https://www.linkedin.com/in/username' },
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
        { error: 'No active LinkedIn account connected. Go to the LinkedIn page to connect one.' },
        { status: 400 },
      )
    }

    const accountId = account.unipile_account_id

    // Resolve slug → provider_id (LinkedIn URN)
    const providerId = await resolveProviderId(accountId, slug)

    const serviceSupabase = createServiceClient()
    const now = new Date().toISOString()

    if (sendMessage) {
      // Already connected → send direct message
      const text =
        note ?? "Bonjour ! Je teste mon assistant IA de prospection. N'hésitez pas à ignorer ce message 😊"
      await sendNewDirectMessage(accountId, providerId, text)

      // ── Persist to DB ──────────────────────────────────────────────────────
      if (prospectId) {
        await Promise.all([
          // Save the outbound message
          serviceSupabase.from('messages').insert({
            user_id: user.id,
            prospect_id: prospectId,
            direction: 'outbound',
            channel: 'linkedin',
            content: text,
            ai_generated: true,
            sent_at: now,
            read_at: null,
            unipile_message_id: null,
          }),
          // Mark prospect as connected
          serviceSupabase
            .from('prospects')
            .update({ connection_status: 'connected', updated_at: now })
            .eq('id', prospectId)
            .eq('user_id', user.id),
        ])
      }

      return NextResponse.json({ ok: true, action: 'message_sent', providerId, prospectId })
    } else {
      // Not connected → send connection request
      const message =
        note ?? 'Hi, I came across your profile and would love to connect!'
      await sendConnectionRequest(accountId, providerId, message)

      // ── Persist to DB ──────────────────────────────────────────────────────
      if (prospectId) {
        await Promise.all([
          // Save the connection request note as an outbound message
          serviceSupabase.from('messages').insert({
            user_id: user.id,
            prospect_id: prospectId,
            direction: 'outbound',
            channel: 'linkedin',
            content: message,
            ai_generated: true,
            sent_at: now,
            read_at: null,
            unipile_message_id: null,
          }),
          // Mark prospect as pending (connection request sent)
          serviceSupabase
            .from('prospects')
            .update({ connection_status: 'pending', updated_at: now })
            .eq('id', prospectId)
            .eq('user_id', user.id),
        ])
      }

      return NextResponse.json({ ok: true, action: 'connection_sent', providerId, prospectId })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message, code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
