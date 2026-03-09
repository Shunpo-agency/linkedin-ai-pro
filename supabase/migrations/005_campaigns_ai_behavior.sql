-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 005 — Campaign AI behavior + lead score breakdown
-- ─────────────────────────────────────────────────────────────────────────────

-- Per-campaign AI behavior config (tone, follow-up delay, custom instructions)
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS ai_behavior jsonb DEFAULT '{}';

-- Structured score breakdown for each prospect (why this score?)
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS score_breakdown jsonb DEFAULT '{}';

-- Add campaign_id to prospects to link them to campaigns
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL;

-- Index for fast activity lookups
CREATE INDEX IF NOT EXISTS idx_agent_runs_campaign_id ON agent_runs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_user_started ON agent_runs(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_prospects_campaign_id ON prospects(campaign_id);

NOTIFY pgrst, 'reload schema';
