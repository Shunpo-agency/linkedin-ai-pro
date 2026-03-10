/**
 * BullMQ Worker Entry Point
 * Run: pnpm dev:workers | pnpm workers (production)
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
import { randomInt } from '@/lib/human-timing'

console.log('[Workers] Starting BullMQ workers…')

// ── Plannings avec variance aléatoire (anti-pattern LinkedIn) ────────────────
async function registerRecurringJobs(): Promise<void> {
  // Découverte : deux créneaux par jour (matin + après-midi) avec jitter
  // Slot 1 : 8h00-8h30 Paris → 6h UTC winter / 7h UTC summer
  // On utilise une fourchette large et laisse le worker gérer le jitter réel
  const morningMinute = randomInt(0, 29) // 8h00-8h29
  await prospectDiscoveryQueue.add(
    'daily-discovery-morning',
    { userId: 'all' },
    {
      repeat: { pattern: `${morningMinute} 7 * * 1-5` }, // lun-ven 8h Paris (7h UTC)
      jobId: 'recurring-discovery-morning',
    },
  )

  // Slot 2 : 14h00-14h30 Paris (après la pause déjeuner)
  const afternoonMinute = randomInt(0, 29)
  await prospectDiscoveryQueue.add(
    'daily-discovery-afternoon',
    { userId: 'all' },
    {
      repeat: { pattern: `${afternoonMinute} 13 * * 1-5` }, // 14h Paris (13h UTC)
      jobId: 'recurring-discovery-afternoon',
    },
  )

  // Follow-up : toutes les 4h pendant les heures ouvrées (8h, 12h, 16h Paris)
  await followUpCheckerQueue.add(
    'follow-up-check',
    { userId: 'all' },
    {
      repeat: { pattern: '0 7,11,15 * * 1-5' }, // 8h, 12h, 16h Paris (UTC)
      jobId: 'recurring-follow-up-check',
    },
  )

  // Envoi des messages planifiés : toutes les 20 min (plus réactif)
  await sendScheduledQueue.add(
    'send-scheduled-check',
    {},
    {
      repeat: { pattern: '*/20 7-19 * * 1-5' }, // toutes les 20 min, heures ouvrées
      jobId: 'recurring-send-scheduled',
    },
  )

  // Persona refiner : lundi matin à 9h Paris
  await personaRefinerQueue.add(
    'weekly-persona-refine',
    { userId: 'all' },
    {
      repeat: { pattern: '0 8 * * 1' }, // lundi 9h Paris
      jobId: 'recurring-persona-refine',
    },
  )

  void generateSequenceQueue

  console.log('[Workers] Recurring jobs registered')
}

registerRecurringJobs().catch((err: Error) => {
  console.error('[Workers] Failed to register recurring jobs:', err.message)
})

// ── Graceful shutdown ────────────────────────────────────────────────────────
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
  console.log('[Workers] SIGTERM — graceful shutdown…')
  await Promise.all(workers.map((w) => w.close()))
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('[Workers] SIGINT — graceful shutdown…')
  await Promise.all(workers.map((w) => w.close()))
  process.exit(0)
})

console.log('[Workers] All workers running:', workers.map((w) => w.name).join(', '))
