import { createServiceClient } from '@/lib/supabase/service'

/**
 * Retrieve the user's calendar booking link from their business settings.
 * Returns null if no link is configured.
 */
export async function getCalendarLink(userId: string): Promise<string | null> {
  const supabase = createServiceClient()

  const { data } = await supabase
    .from('business_settings')
    .select('calendar_link')
    .eq('user_id', userId)
    .maybeSingle()

  return (data?.calendar_link as string | null) ?? null
}

/**
 * Send a booking link message to a prospect.
 * Reads the calendar_link from the user's settings, records the message in the
 * DB, and updates the prospect's booking_status to 'link_sent'.
 */
export async function sendBookingLink(
  userId: string,
  prospectId: string,
): Promise<void> {
  const supabase = createServiceClient()

  const calendarLink = await getCalendarLink(userId)

  if (!calendarLink) {
    throw new Error(
      'No calendar link configured. Go to Settings and add your booking URL.',
    )
  }

  const messageContent = `I'd love to find a time to connect! You can book a slot that works for you here: ${calendarLink}`

  const { error: insertError } = await supabase.from('messages').insert({
    user_id: userId,
    prospect_id: prospectId,
    direction: 'outbound',
    channel: 'linkedin',
    content: messageContent,
    ai_generated: true,
    sent_at: new Date().toISOString(),
  })

  if (insertError) {
    throw new Error(
      `sendBookingLink: failed to create message record — ${insertError.message}`,
    )
  }

  const { error: updateError } = await supabase
    .from('prospects')
    .update({
      booking_status: 'link_sent',
      calendar_event_url: calendarLink,
      updated_at: new Date().toISOString(),
    })
    .eq('id', prospectId)
    .eq('user_id', userId)

  if (updateError) {
    throw new Error(
      `sendBookingLink: failed to update prospect — ${updateError.message}`,
    )
  }
}
