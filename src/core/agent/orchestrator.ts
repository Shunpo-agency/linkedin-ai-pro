// ─────────────────────────────────────────────────────────────────────────────
// Agent orchestrator — resolves an AgentIntent to the appropriate action,
// wraps execution with agent_runs DB logging, and returns an IntentResult.
// ─────────────────────────────────────────────────────────────────────────────

import { createServiceClient } from '@/lib/supabase/service'
import type { AgentIntent, IntentResult } from '@/core/agent/intents/types'
import {
  findAndCreateProspects,
  sendConnectionRequest,
  sendMessage,
  syncInboundMessages,
} from '@/core/agent/actions/linkedin.actions'
import { generateAndQueueMessage, scoreProspectLead } from '@/core/agent/actions/ai.actions'
import { sendBookingLink } from '@/core/agent/actions/calendar.actions'
import { refinePersonaSuggestions } from '@/core/ai/claude.client'

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Resolve an AgentIntent: log the run to agent_runs, dispatch to the correct
 * action handler, and update the run record with the outcome.
 */
export async function resolveIntent(
  intent: AgentIntent,
  userId: string,
): Promise<IntentResult> {
  const supabase = createServiceClient()

  // Create the agent_run record with status 'running'
  const { data: run, error: insertError } = await supabase
    .from('agent_runs')
    .insert({
      user_id: userId,
      intent_type: intent.type,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (insertError || !run) {
    // If we can't log, still proceed but note the issue
    console.error(
      `orchestrator: failed to create agent_run record — ${insertError?.message}`,
    )
  }

  const runId = run?.id ?? null

  async function markSuccess(data: unknown): Promise<IntentResult> {
    if (runId) {
      await supabase
        .from('agent_runs')
        .update({
          status: 'success',
          result: data as import('@/shared/types/database.types').Json,
          completed_at: new Date().toISOString(),
        })
        .eq('id', runId)
    }
    return { success: true, data }
  }

  async function markFailed(error: unknown): Promise<IntentResult> {
    const message =
      error instanceof Error ? error.message : String(error)
    if (runId) {
      await supabase
        .from('agent_runs')
        .update({
          status: 'failed',
          error: message,
          completed_at: new Date().toISOString(),
        })
        .eq('id', runId)
    }
    return { success: false, error: message }
  }

  try {
    switch (intent.type) {
      case 'FIND_PROSPECTS': {
        const { persona, limit, excludeLinkedInIds } = intent.payload
        const result = await findAndCreateProspects(userId, persona, limit, excludeLinkedInIds)
        return markSuccess(result)
      }

      case 'SEND_CONNECTION_REQUEST': {
        const { prospectId, personalizedNote } = intent.payload
        await sendConnectionRequest(userId, prospectId, personalizedNote)
        return markSuccess({ prospectId, status: 'pending' })
      }

      case 'SEND_MESSAGE': {
        const { prospectId, content } = intent.payload
        await sendMessage(userId, prospectId, content)
        return markSuccess({ prospectId, sent: true })
      }

      case 'FOLLOW_UP': {
        const { prospectId } = intent.payload
        // Generate a follow-up message with conversation history, then send it
        const content = await generateAndQueueMessage(userId, prospectId)
        await sendMessage(userId, prospectId, content)
        return markSuccess({ prospectId, content })
      }

      case 'SCORE_LEAD': {
        const { prospectId } = intent.payload
        const leadScore = await scoreProspectLead(userId, prospectId)
        return markSuccess(leadScore)
      }

      case 'REFINE_PERSONA': {
        const { currentPersona, performanceData } = intent.payload
        const refinements = await refinePersonaSuggestions({
          currentPersona,
          performanceData,
        })
        return markSuccess(refinements)
      }

      case 'BOOK_MEETING': {
        const { prospectId } = intent.payload
        await sendBookingLink(userId, prospectId)
        return markSuccess({ prospectId, bookingLinkSent: true })
      }

      default: {
        // Exhaustiveness check — TypeScript will flag unhandled variants
        const _exhaustive: never = intent
        throw new Error(`orchestrator: unhandled intent type — ${JSON.stringify(_exhaustive)}`)
      }
    }
  } catch (error) {
    return markFailed(error)
  }
}

// ---------------------------------------------------------------------------
// Convenience re-export so consumers can import syncInboundMessages from here
// ---------------------------------------------------------------------------

export { syncInboundMessages }
