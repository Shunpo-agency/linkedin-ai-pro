/**
 * BullMQ Worker Entry Point
 *
 * Run with: pnpm dev:workers (tsx src/workers/index.ts)
 * In production: pm2 start dist/workers/index.js
 */

import 'dotenv/config'
import { messageSenderWorker } from './message-sender.worker'
import { leadScorerWorker } from './lead-scorer.worker'
import { followUpCheckerWorker } from './follow-up-checker.worker'
import { prospectDiscoveryWorker } from './prospect-discovery.worker'
import { personaRefinerWorker } from './persona-refiner.worker'
import { conversationReplyWorker } from './conversation-reply.worker'
import { suggestReplyWorker } from './suggest-reply.worker'
import { sequenceGeneratorWorker } from './sequence-generator.worker'
import { sendScheduledWorker } from './send-scheduled.worker'
import {
  prospectDiscoveryQueue,
  followUpCheckerQueue,
  personaRefinerQueue,
  generateSequenceQueue,
  sendScheduledQueue,
} from './queues'

console.log('[Workers] Starting BullMQ workers…')

// Register recurring jobs
async function registerRecurringJobs(): Promise<void> {
  // Daily prospect discovery at 8 AM UTC
  await prospectDiscoveryQueue.add(
    'daily-discovery',
    { userId: 'all' },
    {
      repeat: { pattern: '0 8 * * *' },
      jobId: 'recurring-daily-discovery',
    },
  )

  // Follow-up checker every 6 hours
  await followUpCheckerQueue.add(
    'follow-up-check',
    { userId: 'all' },
    {
      repeat: { pattern: '0 */6 * * *' },
      jobId: 'recurring-follow-up-check',
    },
  )

  // Weekly persona refiner on Monday at 9 AM UTC
  await personaRefinerQueue.add(
    'weekly-persona-refine',
    { userId: 'all' },
    {
      repeat: { pattern: '0 9 * * 1' },
      jobId: 'recurring-persona-refine',
    },
  )

  // Send scheduled messages every 30 minutes
  await sendScheduledQueue.add(
    'send-scheduled-check',
    {},
    {
      repeat: { pattern: '*/30 * * * *' },
      jobId: 'recurring-send-scheduled',
    },
  )

  // Register generateSequenceQueue for reference (jobs added on-demand)
  void generateSequenceQueue

  console.log('[Workers] Recurring jobs registered')
}

registerRecurringJobs().catch((err: Error) => {
  console.error('[Workers] Failed to register recurring jobs:', err.message)
})

// Graceful shutdown
const workers = [
  messageSenderWorker,
  leadScorerWorker,
  followUpCheckerWorker,
  prospectDiscoveryWorker,
  personaRefinerWorker,
  conversationReplyWorker,
  suggestReplyWorker,
  sequenceGeneratorWorker,
  sendScheduledWorker,
]

process.on('SIGTERM', async () => {
  console.log('[Workers] SIGTERM received, shutting down gracefully…')
  await Promise.all(workers.map((w) => w.close()))
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('[Workers] SIGINT received, shutting down gracefully…')
  await Promise.all(workers.map((w) => w.close()))
  process.exit(0)
})

console.log('[Workers] All workers running:', workers.map((w) => w.name).join(', '))
