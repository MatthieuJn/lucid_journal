-- Run this in the Supabase SQL Editor

create table if not exists activity_events (
  id               uuid primary key default gen_random_uuid(),
  source           text not null check (source in ('pc', 'android')),
  bucket_id        text not null,
  event_id         bigint not null,
  timestamp        timestamptz not null,
  duration_seconds integer not null default 0,
  app              text,
  title            text,
  raw_data         jsonb not null default '{}',
  created_at       timestamptz not null default now(),

  unique (source, bucket_id, event_id)
);

-- Index for timeline queries (filter by day)
create index if not exists activity_events_timestamp_idx
  on activity_events (timestamp);

-- Index for per-source queries
create index if not exists activity_events_source_idx
  on activity_events (source, timestamp);

-- RLS: only service role can insert (Python script), anon can read
alter table activity_events enable row level security;

create policy "anon read" on activity_events
  for select using (true);

create policy "service insert" on activity_events
  for insert with check (true);

create policy "service upsert" on activity_events
  for update with check (true);
