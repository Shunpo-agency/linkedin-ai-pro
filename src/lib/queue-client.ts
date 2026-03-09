// ─────────────────────────────────────────────────────────────────────────────
// Lightweight BullMQ queue client for use in Next.js API routes.
// Only defines Queue instances (no Workers) — safe to import server-side.
// Workers (which consume from these queues) run in a separate process.
// ─────────────────────────────────────────────────────────────────────────────

import { Queue } from 'bullmq'
import { Redis } from 'ioredis'

// Use a module-level singleton so we don't create a new Redis connection on
// every hot-reload in development.
let _redis: Redis | null = null

function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    })
    _redis.on('error', (err: Error) => {
      console.error('[queue-client] Redis error:', err.message)
    })
  }
  return _redis
}

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
}

let _conversationReplyQueue: Queue | null = null
let _suggestReplyQueue: Queue | null = null
let _leadScorerQueue: Queue | null = null
let _messageSenderQueue: Queue | null = null

export function getConversationReplyQueue(): Queue {
  if (!_conversationReplyQueue) {
    _conversationReplyQueue = new Queue('conversation-reply', {
      connection: getRedis(),
      defaultJobOptions,
    })
  }
  return _conversationReplyQueue
}

export function getSuggestReplyQueue(): Queue {
  if (!_suggestReplyQueue) {
    _suggestReplyQueue = new Queue('suggest-reply', {
      connection: getRedis(),
      defaultJobOptions,
    })
  }
  return _suggestReplyQueue
}

export function getLeadScorerQueue(): Queue {
  if (!_leadScorerQueue) {
    _leadScorerQueue = new Queue('lead-scorer', {
      connection: getRedis(),
      defaultJobOptions,
    })
  }
  return _leadScorerQueue
}

export function getMessageSenderQueue(): Queue {
  if (!_messageSenderQueue) {
    _messageSenderQueue = new Queue('message-sender', {
      connection: getRedis(),
      defaultJobOptions,
    })
  }
  return _messageSenderQueue
}
