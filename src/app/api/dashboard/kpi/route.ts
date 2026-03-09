import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const [{ count: totalProspects }, { count: messagesSent }, { count: inbound }, { count: meetingsBooked }] =
      await Promise.all([
        supabase
          .from('prospects')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('direction', 'outbound'),
        supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('direction', 'inbound'),
        supabase
          .from('prospects')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('booking_status', 'booked'),
      ])

    const replyRate =
      messagesSent && messagesSent > 0
        ? Math.round(((inbound ?? 0) / messagesSent) * 100)
        : 0

    return NextResponse.json({
      total_prospects: totalProspects ?? 0,
      messages_sent: messagesSent ?? 0,
      reply_rate: replyRate,
      meetings_booked: meetingsBooked ?? 0,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message, code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
