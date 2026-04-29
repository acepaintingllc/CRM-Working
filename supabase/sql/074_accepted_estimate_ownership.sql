alter table public.estimates
  add column if not exists accepted_at timestamptz null,
  add column if not exists accepted_public_version_id uuid null references public.estimate_public_versions(id) on delete set null;

alter table public.jobs
  add column if not exists linked_estimate_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'jobs_linked_estimate_id_fkey'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs
      add constraint jobs_linked_estimate_id_fkey
      foreign key (linked_estimate_id) references public.estimates(id) on delete set null not valid;
  end if;
end $$;

create unique index if not exists estimates_one_accepted_public_version_idx
  on public.estimates (org_id, accepted_public_version_id)
  where accepted_public_version_id is not null;

create index if not exists estimates_accepted_public_version_fk_idx
  on public.estimates (accepted_public_version_id)
  where accepted_public_version_id is not null;

create index if not exists estimates_org_accepted_at_idx
  on public.estimates (org_id, accepted_at desc)
  where accepted_at is not null;

create index if not exists jobs_org_linked_estimate_idx
  on public.jobs (org_id, linked_estimate_id)
  where linked_estimate_id is not null;

create index if not exists jobs_linked_estimate_fk_idx
  on public.jobs (linked_estimate_id)
  where linked_estimate_id is not null;

with ranked_accepted_public_versions as (
  select
    versions.id,
    row_number() over (
      partition by versions.org_id, versions.estimate_id
      order by
        case
          when estimates.accepted_public_version_id = versions.id then 0
          else 1
        end,
        versions.accepted_at asc nulls last,
        versions.created_at asc,
        versions.id asc
    ) as rn
  from public.estimate_public_versions versions
  left join public.estimates estimates
    on estimates.id = versions.estimate_id
   and estimates.org_id = versions.org_id
  where versions.status = 'accepted'
)
update public.estimate_public_versions versions
set
  status = case when versions.viewed_at is not null then 'viewed' else 'sent' end,
  accepted_at = null,
  locked_at = null,
  acceptance_json = null
from ranked_accepted_public_versions ranked
where versions.id = ranked.id
  and ranked.rn > 1;

create unique index if not exists estimate_public_versions_one_accepted_per_estimate_idx
  on public.estimate_public_versions (org_id, estimate_id)
  where status = 'accepted';

with ranked_terminal_events as (
  select
    events.id,
    row_number() over (
      partition by events.estimate_public_version_id
      order by
        case
          when v.status in ('accepted', 'declined')
            and events.event_type = v.status then 0
          else 1
        end,
        events.created_at asc,
        events.id asc
    ) as rn
  from public.estimate_public_events events
  join public.estimate_public_versions v
    on v.id = events.estimate_public_version_id
  where events.event_type in ('accepted', 'declined')
)
delete from public.estimate_public_events events
using ranked_terminal_events ranked
where events.id = ranked.id
  and ranked.rn > 1;

create unique index if not exists estimate_public_events_terminal_once_idx
  on public.estimate_public_events (estimate_public_version_id)
  where event_type in ('accepted', 'declined');
