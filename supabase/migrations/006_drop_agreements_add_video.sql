-- 1) Agreements are handled outside the tool, so the old agreement table is no longer used.
drop table if exists public.avatar_agreements;

-- 2) Video avatar settings per avatar (provider, replica id, whether it is switched on). Safe to re-run.
alter table public.personas
  add column if not exists video_config jsonb not null default '{}'::jsonb;
