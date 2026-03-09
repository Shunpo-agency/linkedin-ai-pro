-- ─────────────────────────────────────────────────────────────────────────────
-- Campaigns v2 — add type + extended config columns
-- ─────────────────────────────────────────────────────────────────────────────

-- Campaign type: prospect_discovery = search & connect new leads
--               outreach = send messages to existing CRM prospects
alter table campaigns
  add column if not exists type text not null default 'outreach'
    check (type in ('prospect_discovery', 'outreach')),
  add column if not exists daily_invite_limit integer not null default 15,
  add column if not exists audience_filters jsonb default '{}';

-- For discovery campaigns, persona_snapshot already holds the persona config.
-- audience_filters stores outreach-specific prospect filters
-- (e.g. temperature, connection_status).

notify pgrst, 'reload schema';
