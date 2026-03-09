import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { subDays, format, eachDayOfInterval } from 'date-fns'

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const thirtyDaysAgo = subDays(new Date(), 30).toISOString()

    const [{ data: msgData }, { data: prospectData }] = await Promise.all([
      supabase
        .from('messages')
        .select('sent_at')
        .eq('user_id', user.id)
        .eq('direction', 'outbound')
        .gte('sent_at', thirtyDaysAgo),
      supabase
        .from('prospects')
        .select('temperature')
        .eq('user_id', user.id),
    ])

    // Build daily timeline
    const days = eachDayOfInterval({
      start: subDays(new Date(), 29),
      end: new Date(),
    })

    const countsByDay: Record<string, number> = {}
    days.forEach((d) => {
      countsByDay[format(d, 'MMM d')] = 0
    })

    msgData?.forEach((msg) => {
      const label = format(new Date(msg.sent_at), 'MMM d')
      if (label in countsByDay) {
        countsByDay[label] = (countsByDay[label] ?? 0) + 1
      }
    })

    const timeline = Object.entries(countsByDay).map(([date, count]) => ({ date, count }))

    // Temperature distribution
    const temperatures = { cold: 0, warm: 0, hot: 0 }
    prospectData?.forEach((p) => {
      if (p.temperature === 'cold') temperatures.cold++
      else if (p.temperature === 'warm') temperatures.warm++
      else if (p.temperature === 'hot') temperatures.hot++
    })

    return NextResponse.json({ timeline, temperatures })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message, code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
