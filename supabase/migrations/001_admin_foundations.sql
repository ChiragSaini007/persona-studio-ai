-- Fanline admin foundations: ops-managed avatars, signed agreements, append-only audit log.
-- Run once in the Supabase SQL editor. Safe to re-run.

alter table public.personas
  add column if not exists managed_by_admin boolean not null default false,
  add column if not exists claim_email text,
  add column if not exists approval_status text not null default 'none',
  add column if not exists approved_by_email text,
  add column if not exists approved_at timestamptz,
  add column if not exists created_by_admin_email text,
  add column if not exists internal_notes text not null default '';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'personas_approval_status_check') then
    alter table public.personas
      add constraint personas_approval_status_check
      check (approval_status in ('none', 'pending', 'approved', 'changes_requested'));
  end if;
end $$;

create table if not exists public.avatar_agreements (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.personas(id) on delete cascade,
  channel text not null check (channel in ('text', 'voice', 'realtime_voice', 'video', 'realtime_video')),
  signed_by_name text not null,
  signer_role text not null check (signer_role in ('creator', 'authorised_representative')),
  signed_on date not null,
  expires_on date,
  scope_notes text not null default '',
  file_path text not null,
  status text not null default 'active' check (status in ('active', 'revoked')),
  uploaded_by_email text not null,
  revoked_by_email text,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists avatar_agreements_persona_idx on public.avatar_agreements (persona_id, channel);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  actor_email text not null,
  action text not null,
  persona_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_persona_idx on public.admin_audit_log (persona_id, created_at desc);

-- The audit log can be appended to but never edited or deleted.
create or replace function public.prevent_audit_mutation() returns trigger as $$
begin
  raise exception 'admin_audit_log is append-only';
end;
$$ language plpgsql;

drop trigger if exists admin_audit_no_mutation on public.admin_audit_log;
create trigger admin_audit_no_mutation
  before update or delete on public.admin_audit_log
  for each row execute function public.prevent_audit_mutation();

-- Service-role only: no policies means the public/anon key cannot read or write these tables.
alter table public.avatar_agreements enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.personas enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
