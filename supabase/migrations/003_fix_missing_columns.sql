-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: add columns that were missing from the initial table creation
-- Safe to run multiple times (ADD COLUMN IF NOT EXISTS).
-- ─────────────────────────────────────────────────────────────────────────────

-- business_settings: add ai_behavior + calendar_link if they don't exist yet
alter table business_settings
  add column if not exists ai_behavior   jsonb default '{}',
  add column if not exists calendar_link text;

-- Ensure the schema cache is reloaded (PostgREST picks up new columns automatically
-- on the next request, but running NOTIFY forces an immediate reload in Supabase).
notify pgrst, 'reload schema';
