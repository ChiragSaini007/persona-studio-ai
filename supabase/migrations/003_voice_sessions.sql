-- Real-time voice (and later video) calls: one row per call, for limits, billing estimates, review and the kill switch.
-- Safe to re-run.
create table if not exists public.voice_sessions (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.personas(id) on delete cascade,
  fan_user_id uuid not null,
  channel text not null default 'realtime_voice' check (channel in ('realtime_voice', 'realtime_video')),
  call_id text,
  status text not null default 'active' check (status in ('active', 'ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  seconds integer not null default 0,
  max_seconds integer not null,
  ended_reason text,
  transcript jsonb not null default '[]'::jsonb,
  flagged_turns integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists voice_sessions_persona_idx on public.voice_sessions (persona_id, started_at desc);
create index if not exists voice_sessions_fan_idx on public.voice_sessions (fan_user_id, started_at desc);

alter table public.voice_sessions enable row level security;
