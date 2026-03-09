-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 1 — Semi-Auto Replies + Intent Signals
-- ─────────────────────────────────────────────────────────────────────────────

-- AI-generated reply suggestions awaiting user review
create table if not exists ai_suggested_replies (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users not null,
  prospect_id         uuid references prospects not null,
  inbound_message_id  uuid references messages,
  suggested_content   text not null,
  status              text not null default 'pending',  -- pending | approved | modified | ignored
  final_content       text,        -- set when user approves with optional edits
  reviewed_at         timestamptz,
  created_at          timestamptz default now()
);

alter table ai_suggested_replies enable row level security;
create policy "Users own suggested replies"
  on ai_suggested_replies for all
  using (auth.uid() = user_id);

create index on ai_suggested_replies (user_id, status);
create index on ai_suggested_replies (prospect_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Intent signals — LinkedIn interactions that indicate buying intent
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists intent_signals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users not null,
  prospect_id  uuid references prospects not null,
  signal_type  text not null,  -- connection_accepted | message_replied | profile_view | post_like | post_comment | content_share
  points       int  not null default 10,
  occurred_at  timestamptz not null default now(),
  metadata     jsonb
);

alter table intent_signals enable row level security;
create policy "Users own intent signals"
  on intent_signals for all
  using (auth.uid() = user_id);

create index on intent_signals (user_id, prospect_id);
create index on intent_signals (prospect_id, occurred_at desc);
