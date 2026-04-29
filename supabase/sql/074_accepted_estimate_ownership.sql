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
