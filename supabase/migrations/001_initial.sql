-- LinkedIn AI Prospecting App — Initial Schema

-- Business settings per user
create table if not exists business_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null unique,
  business_name text,
  business_description text,
  offers jsonb default '[]',
  main_features jsonb default '[]',
  business_model text,
  target_persona jsonb,
  ai_behavior jsonb default '{}',
  calendar_link text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- LinkedIn accounts connected via Unipile
create table if not exists linkedin_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  unipile_account_id text not null unique,
  linkedin_profile_url text,
  linkedin_name text,
  status text default 'active' check (status in ('active', 'disconnected', 'rate_limited')),
  connected_at timestamptz default now()
);

-- Prospects (leads)
create table if not exists prospects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  linkedin_profile_url text not null,
  linkedin_id text,
  first_name text,
  last_name text,
  job_title text,
  company text,
  industry text,
  location text,
  profile_picture_url text,
  connection_status text default 'not_connected' check (connection_status in ('not_connected', 'pending', 'connected')),
  lead_score integer default 0 check (lead_score >= 0 and lead_score <= 100),
  temperature text default 'cold' check (temperature in ('cold', 'warm', 'hot')),
  booking_status text default 'none' check (booking_status in ('none', 'link_sent', 'booked')),
  calendar_event_url text,
  ai_notes text,
  source text default 'ai_search',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Messages
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  prospect_id uuid references prospects(id) on delete cascade not null,
  direction text not null check (direction in ('outbound', 'inbound')),
  channel text default 'linkedin' check (channel in ('linkedin', 'email')),
  content text not null,
  unipile_message_id text,
  sent_at timestamptz default now(),
  read_at timestamptz,
  ai_generated boolean default true
);

-- Campaigns
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  status text default 'active' check (status in ('active', 'paused', 'completed')),
  persona_snapshot jsonb,
  prospects_count integer default 0,
  messages_sent integer default 0,
  replies_count integer default 0,
  meetings_booked integer default 0,
  started_at timestamptz default now(),
  ended_at timestamptz
);

-- Agent run logs
create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  campaign_id uuid references campaigns(id) on delete set null,
  intent_type text not null,
  status text default 'pending' check (status in ('pending', 'running', 'success', 'failed')),
  result jsonb,
  error text,
  started_at timestamptz default now(),
  completed_at timestamptz
);

-- Row Level Security
alter table business_settings enable row level security;
alter table linkedin_accounts enable row level security;
alter table prospects enable row level security;
alter table messages enable row level security;
alter table campaigns enable row level security;
alter table agent_runs enable row level security;

-- RLS Policies — users can only see/modify their own rows
create policy "Users own data" on business_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users own data" on linkedin_accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users own data" on prospects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users own data" on messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users own data" on campaigns
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users own data" on agent_runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Indexes for common query patterns
create index if not exists idx_prospects_user_temperature on prospects(user_id, temperature);
create index if not exists idx_prospects_user_connection on prospects(user_id, connection_status);
create index if not exists idx_prospects_user_booking on prospects(user_id, booking_status);
create index if not exists idx_messages_prospect on messages(user_id, prospect_id);
create index if not exists idx_messages_sent_at on messages(user_id, sent_at desc);
create index if not exists idx_agent_runs_user_status on agent_runs(user_id, status);
create index if not exists idx_agent_runs_started_at on agent_runs(user_id, started_at desc);

-- updated_at trigger
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_business_settings_updated_at
  before update on business_settings
  for each row execute function update_updated_at_column();

create trigger update_prospects_updated_at
  before update on prospects
  for each row execute function update_updated_at_column();
