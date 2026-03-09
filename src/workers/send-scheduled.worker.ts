import { Worker } from 'bullmq'
import { redis } from './redis'
import { createServiceClient } from '@/lib/supabase/service'
import { sendMessage, sendConnectionRequest } from '@/core/agent/actions/linkedin.actions'

export const sendScheduledWorker = new Worker(
  'send-scheduled',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (_job) => {
    console.log('[send-scheduled] Checking scheduled messages…')

    const supabase = createServiceClient()
    const now = new Date().toISOString()

    // Find all pending messages that are due
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: dueMessages } = await (supabase as any)
      .from('message_sequences')
      .select('id, user_id, prospect_id, step, content')
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .limit(20)

    if (!dueMessages?.length) {
      console.log('[send-scheduled] No messages due')
      return { sent: 0 }
    }

    let sent = 0

    for (const msg of dueMessages as Array<{ id: string; user_id: string; prospect_id: string; step: number; content: string }>) {
      try {
        // Pause if a more recent message got a reply
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: prospect } = await (supabase as any)
          .from('prospects')
          .select('connection_status, id')
          .eq('id', msg.prospect_id)
          .single()

        // Check if sequence is paused for this prospect
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: pausedCheck } = await (supabase as any)
          .from('message_sequences')
          .select('status')
          .eq('prospect_id', msg.prospect_id)
          .eq('status', 'paused')
          .limit(1)

        if (pausedCheck?.length) {
          // Pause remaining steps too
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('message_sequences')
            .update({ status: 'paused' })
            .eq('prospect_id', msg.prospect_id)
            .eq('status', 'pending')
          continue
        }

        // Step 1 = connection request, others = message
        if (msg.step === 1 && prospect?.connection_status === 'not_connected') {
          await sendConnectionRequest(msg.user_id, msg.prospect_id, msg.content)
        } else if (prospect?.connection_status === 'connected') {
          await sendMessage(msg.user_id, msg.prospect_id, msg.content)
        } else {
          // Not connected yet — reschedule by 1 day
          const newDate = new Date()
          newDate.setDate(newDate.getDate() + 1)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('message_sequences')
            .update({ scheduled_at: newDate.toISOString() })
            .eq('id', msg.id)
          continue
        }

        // Mark as sent
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('message_sequences')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', msg.id)

        sent++

        // Delay between sends (2-5 min jitter to avoid bot detection)
        await new Promise((r) => setTimeout(r, 2 * 60 * 1000 + Math.random() * 3 * 60 * 1000))
      } catch (err) {
        console.error(`[send-scheduled] Failed for msg ${msg.id}:`, err)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('message_sequences')
          .update({ status: 'pending' })
          .eq('id', msg.id)
      }
    }

    console.log(`[send-scheduled] Sent ${sent} messages`)
    return { sent }
  },
  {
    connection: redis,
    concurrency: 1, // serial to respect rate limits
  },
)

sendScheduledWorker.on('failed', (job, err) => {
  console.error(`[send-scheduled] Job ${job?.id} failed:`, err.message)
})
