-- Simplified rights model: agreements happen outside the tool. Each avatar records who confirmed rights, when,
-- a one-line reference, and where the avatar may be used. Safe to re-run.

alter table public.personas
  add column if not exists rights_confirmed_by_email text,
  add column if not exists rights_confirmed_at timestamptz,
  add column if not exists rights_reference text,
  add column if not exists territories text[] not null default array['IN', 'US'];

-- Carry over anything already recorded in the old agreement table, so nothing silently loses its confirmation.
update public.personas p
set rights_confirmed_at = a.created_at,
    rights_confirmed_by_email = a.uploaded_by_email,
    rights_reference = 'Carried over from an earlier agreement record',
    territories = coalesce(a.territories, array['IN', 'US'])
from (
  select distinct on (persona_id) persona_id, created_at, uploaded_by_email, territories
  from public.avatar_agreements
  where channel = 'text' and status = 'active'
  order by persona_id, created_at desc
) a
where a.persona_id = p.id and p.rights_confirmed_at is null;
