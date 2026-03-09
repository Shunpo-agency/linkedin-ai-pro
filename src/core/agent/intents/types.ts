// ─────────────────────────────────────────────────────────────────────────────
// Agent intent types — discriminated union covering every action the AI agent
// can request. All payload shapes are fully typed; no `any` used here.
// ─────────────────────────────────────────────────────────────────────────────

// ---------------------------------------------------------------------------
// Shared domain models
// ---------------------------------------------------------------------------

export interface PersonaConfig {
  roles: string[]
  industries: string[]
  companySizes: string[]
  locations: string[]
  keywords: string[]
}

export interface MessageRecord {
  id: string
  direction: 'inbound' | 'outbound'
  content: string
  sentAt: string
}

export interface CampaignPerformanceData {
  totalProspects: number
  messagesSent: number
  repliesCount: number
  meetingsBooked: number
  replyRate: number
}

export interface LeadScore {
  score: number
  temperature: 'cold' | 'warm' | 'hot'
  reasoning: string
}

// ---------------------------------------------------------------------------
// Individual intent shapes
// ---------------------------------------------------------------------------

export interface FindProspectsIntent {
  type: 'FIND_PROSPECTS'
  payload: {
    persona: PersonaConfig
    limit: number
    excludeLinkedInIds: string[]
  }
}

export interface SendConnectionRequestIntent {
  type: 'SEND_CONNECTION_REQUEST'
  payload: {
    prospectId: string
    personalizedNote: string
  }
}

export interface SendMessageIntent {
  type: 'SEND_MESSAGE'
  payload: {
    prospectId: string
    content: string
    channel: 'linkedin'
  }
}

export interface FollowUpIntent {
  type: 'FOLLOW_UP'
  payload: {
    prospectId: string
    daysSinceLastMessage: number
  }
}

export interface ScoreLeadIntent {
  type: 'SCORE_LEAD'
  payload: {
    prospectId: string
    conversationHistory: MessageRecord[]
  }
}

export interface RefinePersonaIntent {
  type: 'REFINE_PERSONA'
  payload: {
    currentPersona: PersonaConfig
    performanceData: CampaignPerformanceData
  }
}

export interface BookMeetingIntent {
  type: 'BOOK_MEETING'
  payload: {
    prospectId: string
  }
}

// ---------------------------------------------------------------------------
// Discriminated union
// ---------------------------------------------------------------------------

export type AgentIntent =
  | FindProspectsIntent
  | SendConnectionRequestIntent
  | SendMessageIntent
  | FollowUpIntent
  | ScoreLeadIntent
  | RefinePersonaIntent
  | BookMeetingIntent

// ---------------------------------------------------------------------------
// Result wrapper
// ---------------------------------------------------------------------------

export interface IntentResult {
  success: boolean
  data?: unknown
  error?: string
}
