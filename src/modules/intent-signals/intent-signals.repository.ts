/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from '@/lib/supabase/service'
import type { IntentSignal } from './intent-signals.types'

function db(): any {
  return createServiceClient() as any
}

export async function getByProspect(
  userId: string,
  prospectId: string,
): Promise<IntentSignal[]> {
  const { data, error } = await db()
    .from('intent_signals')
    .select('*')
    .eq('user_id', userId)
    .eq('prospect_id', prospectId)
    .order('occurred_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch intent signals: ${error.message}`)
  }

  return (data ?? []) as IntentSignal[]
}

export async function getTotalScore(userId: string, prospectId: string): Promise<number> {
  const signals = await getByProspect(userId, prospectId)
  // Simple sum — no decay for now; can add time decay later
  return signals.reduce((sum, s) => sum + (s.points ?? 0), 0)
}
