-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 006 — Profile analysis, lead scoring breakdown, message sequences
-- ─────────────────────────────────────────────────────────────────────────────

-- Profile analysis on prospects (Feature 4: Profile Analyzer)
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS profile_analysis jsonb DEFAULT '{}';

-- Score breakdown on prospects (Feature 1: Lead Scoring Engine)
-- (score_breakdown already added in migration 005, this is a safety add)
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS score_breakdown jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS score_updated_at timestamptz;

-- ─── Message sequences (Feature 2) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_sequences (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users NOT NULL,
  prospect_id     uuid REFERENCES prospects(id) ON DELETE CASCADE NOT NULL,
  campaign_id     uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  step            int NOT NULL,          -- 1=J0 connexion, 2=J2 accroche, 3=J5 valeur, 4=J10 breakup
  content         text NOT NULL,
  status          text NOT NULL DEFAULT 'pending', -- pending | sent | replied | skipped | paused
  scheduled_at    timestamptz NOT NULL,
  sent_at         timestamptz,
  unipile_message_id text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE message_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own sequences" ON message_sequences FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_sequences_user_status ON message_sequences(user_id, status);
CREATE INDEX IF NOT EXISTS idx_sequences_scheduled ON message_sequences(scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_sequences_prospect ON message_sequences(prospect_id);

-- AI logs for all Claude API calls (for cost tracking)
CREATE TABLE IF NOT EXISTS ai_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users,
  feature         text NOT NULL,  -- 'profile_analysis' | 'lead_scoring' | 'sequence_gen' | 'reply_gen'
  prompt_tokens   int DEFAULT 0,
  completion_tokens int DEFAULT 0,
  latency_ms      int DEFAULT 0,
  cost_usd        numeric(10,6) DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_logs_user ON ai_logs(user_id, created_at DESC);

NOTIFY pgrst, 'reload schema';
