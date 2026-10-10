-- Voice replies: per-avatar voice settings (preset voice, style instructions, on/off). Safe to re-run.
alter table public.personas
  add column if not exists voice_config jsonb not null default '{}'::jsonb;
