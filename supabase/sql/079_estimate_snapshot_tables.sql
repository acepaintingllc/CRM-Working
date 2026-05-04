-- Immutable sold-estimate snapshots.
-- Snapshot builders insert these rows once; downstream actuals/reviews read them
-- without needing live estimate tables to remain unchanged.

create table if not exists public.estimate_snapshot (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete restrict,
  job_id uuid not null references public.jobs(id) on delete restrict,
  estimate_id uuid not null references public.estimates(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  accepted_public_version_id uuid null references public.estimate_public_versions(id) on delete restrict,
  setting_set_id_used uuid null references public.estimator_setting_set(id) on delete restrict,
  snapshot_created_reason text not null
    check (snapshot_created_reason in ('accepted', 'manual_sold', 'backfill')),
  estimate_version_name text null,
  estimate_version_state text null,
  estimate_version_kind text null,
  estimated_labor_hours numeric not null default 0,
  estimated_paint_gallons numeric not null default 0,
  estimated_primer_gallons numeric not null default 0,
  estimated_paint_material_cost numeric not null default 0,
  estimated_supplies_cost numeric not null default 0,
  estimated_other_cost numeric not null default 0,
  estimated_access_cost numeric not null default 0,
  estimated_total numeric not null default 0,
  assumptions_json jsonb not null default '{}'::jsonb,
  totals_json jsonb not null default '{}'::jsonb,
  source_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  unique (org_id, estimate_id),
  constraint estimate_snapshot_identity_scope_uniq
    unique (id, org_id, job_id, estimate_id)
);

create table if not exists public.estimate_snapshot_line (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.estimate_snapshot(id) on delete restrict,
  org_id uuid not null references public.orgs(id) on delete restrict,
  job_id uuid not null references public.jobs(id) on delete restrict,
  estimate_id uuid not null references public.estimates(id) on delete restrict,
  line_key text not null,
  line_kind text not null
    check (line_kind in ('walls', 'ceilings', 'trim', 'doors', 'drywall', 'other', 'access', 'policy', 'summary')),
  room_id text null,
  source_table text null,
  source_row_id text null,
  label text not null,
  position integer not null default 0,
  estimated_labor_hours numeric not null default 0,
  estimated_paint_gallons numeric not null default 0,
  estimated_primer_gallons numeric not null default 0,
  estimated_material_cost numeric not null default 0,
  estimated_supply_cost numeric not null default 0,
  estimated_total numeric not null default 0,
  assumptions_json jsonb not null default '{}'::jsonb,
  output_json jsonb not null default '{}'::jsonb,
  constraint estimate_snapshot_line_snapshot_scope_fkey
    foreign key (snapshot_id, org_id, job_id, estimate_id)
    references public.estimate_snapshot (id, org_id, job_id, estimate_id)
    on delete restrict,
  unique (snapshot_id, line_key)
);

create index if not exists estimate_snapshot_org_job_idx
  on public.estimate_snapshot (org_id, job_id, created_at desc);

create index if not exists estimate_snapshot_org_accepted_public_version_idx
  on public.estimate_snapshot (org_id, accepted_public_version_id)
  where accepted_public_version_id is not null;

create index if not exists estimate_snapshot_org_setting_set_idx
  on public.estimate_snapshot (org_id, setting_set_id_used)
  where setting_set_id_used is not null;

create index if not exists estimate_snapshot_line_snapshot_position_idx
  on public.estimate_snapshot_line (snapshot_id, position, id);

create index if not exists estimate_snapshot_line_org_job_idx
  on public.estimate_snapshot_line (org_id, job_id, position, id);

create index if not exists estimate_snapshot_line_org_estimate_idx
  on public.estimate_snapshot_line (org_id, estimate_id, position, id);

create or replace function public.prevent_estimate_snapshot_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception '% rows are immutable after insert', tg_table_name
    using errcode = '55000';
end;
$$;

drop trigger if exists trg_estimate_snapshot_immutable_update on public.estimate_snapshot;
create trigger trg_estimate_snapshot_immutable_update
before update on public.estimate_snapshot
for each row execute function public.prevent_estimate_snapshot_mutation();

drop trigger if exists trg_estimate_snapshot_immutable_delete on public.estimate_snapshot;
create trigger trg_estimate_snapshot_immutable_delete
before delete on public.estimate_snapshot
for each row execute function public.prevent_estimate_snapshot_mutation();

drop trigger if exists trg_estimate_snapshot_line_immutable_update on public.estimate_snapshot_line;
create trigger trg_estimate_snapshot_line_immutable_update
before update on public.estimate_snapshot_line
for each row execute function public.prevent_estimate_snapshot_mutation();

drop trigger if exists trg_estimate_snapshot_line_immutable_delete on public.estimate_snapshot_line;
create trigger trg_estimate_snapshot_line_immutable_delete
before delete on public.estimate_snapshot_line
for each row execute function public.prevent_estimate_snapshot_mutation();

alter table public.estimate_snapshot enable row level security;
alter table public.estimate_snapshot_line enable row level security;

drop policy if exists estimate_snapshot_select on public.estimate_snapshot;
create policy estimate_snapshot_select
  on public.estimate_snapshot
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_snapshot.org_id
    )
  );

drop policy if exists estimate_snapshot_insert on public.estimate_snapshot;
create policy estimate_snapshot_insert
  on public.estimate_snapshot
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_snapshot.org_id
    )
  );

drop policy if exists estimate_snapshot_line_select on public.estimate_snapshot_line;
create policy estimate_snapshot_line_select
  on public.estimate_snapshot_line
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_snapshot_line.org_id
    )
  );

drop policy if exists estimate_snapshot_line_insert on public.estimate_snapshot_line;
create policy estimate_snapshot_line_insert
  on public.estimate_snapshot_line
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_snapshot_line.org_id
    )
  );
