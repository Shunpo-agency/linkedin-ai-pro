import { Redis } from 'ioredis'

export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null, // required for BullMQ
})

redis.on('error', (err: Error) => {
  console.error('[Redis] Connection error:', err.message)
})
