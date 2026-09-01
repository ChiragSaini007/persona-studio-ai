create extension if not exists pgcrypto;

create table if not exists public.personas (
  id uuid primary key default gen_random_uuid(),
  creator_name text not null,
  creator_handle text not null unique,
  source_content text not null default '',
  profile jsonb not null default '{"topics":[],"phrases":[],"tone":[]}'::jsonb,
  enabled_guardrails jsonb not null default '{}'::jsonb,
  custom_boundary text not null default '',
  fallback_text text not null,
  monetization text not null default 'free' check (monetization in ('free', 'pay_per_conversation')),
  price_cents integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'live', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.personas(id) on delete cascade,
  paid boolean not null default false,
  stripe_session_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('fan', 'persona')),
  text text not null,
  flagged boolean not null default false,
  flag_reason text,
  created_at timestamptz not null default now()
);

create index if not exists personas_handle_idx on public.personas (creator_handle);
create index if not exists conversations_persona_idx on public.conversations (persona_id, created_at desc);
create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at asc);
create index if not exists messages_flagged_idx on public.messages (flagged) where flagged = true;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists personas_touch_updated_at on public.personas;
create trigger personas_touch_updated_at
before update on public.personas
for each row
execute function public.touch_updated_at();
