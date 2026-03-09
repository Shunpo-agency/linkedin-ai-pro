import { Worker } from 'bullmq'
import { redis } from './redis'
import { sendMessage, sendConnectionRequest } from '@/core/agent/actions/linkedin.actions'

interface MessageSenderJob {
  userId: string
  prospectId: string
  content: string
  /** 'connection_request' = invitation LinkedIn, 'message' = message direct (défaut) */
  type?: 'message' | 'connection_request'
}

export const messageSenderWorker = new Worker<MessageSenderJob>(
  'message-sender',
  async (job) => {
    const { userId, prospectId, content, type = 'message' } = job.data
    console.log(
      `[message-sender] Processing ${type} job ${job.id} for prospect ${prospectId}`,
    )

    // Note: human-like delays are applied at the JOB level via BullMQ's
    // `delay` option when the job is added to the queue — NOT here.
    // Using setTimeout() inside the worker blocks the event loop and prevents
    // BullMQ from processing other jobs concurrently.

    if (type === 'connection_request') {
      await sendConnectionRequest(userId, prospectId, content)
      console.log(`[message-sender] Connection request sent to prospect ${prospectId}`)
    } else {
      await sendMessage(userId, prospectId, content)
      console.log(`[message-sender] Message sent to prospect ${prospectId}`)
    }
  },
  {
    connection: redis,
    concurrency: 5,
  },
)

messageSenderWorker.on('failed', (job, err) => {
  console.error(`[message-sender] Job ${job?.id} failed:`, err.message)
})
