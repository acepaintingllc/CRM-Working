create table if not exists public.estimate_public_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  version_number int not null default 1,
  status text not null default 'draft' check (status in ('draft', 'sent', 'viewed', 'accepted', 'declined', 'superseded')),
  public_token text null,
  to_email text null,
  cc_email text null,
  bcc_email text null,
  subject text null,
  body text null,
  template_key text null,
  snapshot_json jsonb not null default '{}'::jsonb,
  draft_json jsonb not null default '{}'::jsonb,
  acceptance_json jsonb null,
  sent_at timestamptz null,
  viewed_at timestamptz null,
  accepted_at timestamptz null,
  declined_at timestamptz null,
  locked_at timestamptz null,
  created_by uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists estimate_public_versions_token_uniq
  on public.estimate_public_versions (public_token)
  where public_token is not null;

create index if not exists estimate_public_versions_org_idx
  on public.estimate_public_versions (org_id);

create index if not exists estimate_public_versions_estimate_idx
  on public.estimate_public_versions (org_id, estimate_id, version_number desc, created_at desc);

create index if not exists estimate_public_versions_status_idx
  on public.estimate_public_versions (org_id, estimate_id, status);

create table if not exists public.estimate_public_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  estimate_public_version_id uuid not null references public.estimate_public_versions(id) on delete cascade,
  event_type text not null check (event_type in ('draft_saved', 'sent', 'viewed', 'accepted', 'declined', 'superseded', 'pdf_requested')),
  actor_type text not null default 'system' check (actor_type in ('system', 'customer', 'staff')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists estimate_public_events_org_idx
  on public.estimate_public_events (org_id);

create index if not exists estimate_public_events_version_idx
  on public.estimate_public_events (estimate_public_version_id, created_at desc);

alter table public.estimate_public_versions enable row level security;
alter table public.estimate_public_events enable row level security;

drop trigger if exists trg_estimate_public_versions_set_updated_at on public.estimate_public_versions;
create trigger trg_estimate_public_versions_set_updated_at
before update on public.estimate_public_versions
for each row execute function public.set_updated_at();

drop policy if exists "estimate_public_versions_select" on public.estimate_public_versions;
create policy "estimate_public_versions_select"
  on public.estimate_public_versions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_public_versions.org_id
    )
  );

drop policy if exists "estimate_public_versions_write" on public.estimate_public_versions;
create policy "estimate_public_versions_write"
  on public.estimate_public_versions
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_public_versions.org_id
    )
  )
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_public_versions.org_id
    )
  );

drop policy if exists "estimate_public_events_select" on public.estimate_public_events;
create policy "estimate_public_events_select"
  on public.estimate_public_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_public_events.org_id
    )
  );

drop policy if exists "estimate_public_events_write" on public.estimate_public_events;
create policy "estimate_public_events_write"
  on public.estimate_public_events
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_public_events.org_id
    )
  )
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_public_events.org_id
    )
  );

