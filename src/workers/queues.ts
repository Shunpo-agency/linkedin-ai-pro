import { Queue } from 'bullmq'
import { redis } from './redis'

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
}

export const prospectDiscoveryQueue = new Queue('prospect-discovery', {
  connection: redis,
  defaultJobOptions,
})

export const messageSenderQueue = new Queue('message-sender', {
  connection: redis,
  defaultJobOptions,
})

export const followUpCheckerQueue = new Queue('follow-up-checker', {
  connection: redis,
  defaultJobOptions,
})

export const leadScorerQueue = new Queue('lead-scorer', {
  connection: redis,
  defaultJobOptions,
})

export const personaRefinerQueue = new Queue('persona-refiner', {
  connection: redis,
  defaultJobOptions,
})

export const conversationReplyQueue = new Queue('conversation-reply', {
  connection: redis,
  defaultJobOptions,
})

export const suggestReplyQueue = new Queue('suggest-reply', {
  connection: redis,
  defaultJobOptions,
})

export const generateSequenceQueue = new Queue('generate-sequence', {
  connection: redis,
  defaultJobOptions,
})

export const sendScheduledQueue = new Queue('send-scheduled', {
  connection: redis,
  defaultJobOptions,
})
