-- Persona variants (genre modes), agreement territories (India / US), and example avatars. Safe to re-run.

alter table public.personas
  add column if not exists active_variant_id uuid,
  add column if not exists is_example boolean not null default false;

create table if not exists public.persona_variants (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.personas(id) on delete cascade,
  name text not null,
  genre text not null default 'custom',
  description text not null default '',
  overlay jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'archived')),
  approval_status text not null default 'none' check (approval_status in ('none', 'pending', 'approved', 'changes_requested')),
  approved_by_email text,
  approved_at timestamptz,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists persona_variants_persona_idx on public.persona_variants (persona_id, created_at);
alter table public.persona_variants enable row level security;

-- Where an agreement allows the avatar to be used. IN = India, US = United States, ROW = rest of world.
alter table public.avatar_agreements
  add column if not exists territories text[] not null default array['IN', 'US'];
