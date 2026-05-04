-- Job-level actuals v1 for estimate feedback.
-- Actuals are scoped to immutable estimate snapshots so review work can compare
-- against stable accepted-estimate truth.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'estimate_snapshot_job_scope_uniq'
      and conrelid = 'public.estimate_snapshot'::regclass
  ) then
    alter table public.estimate_snapshot
      add constraint estimate_snapshot_job_scope_uniq unique (id, org_id, job_id);
  end if;
end;
$$;

create table if not exists public.job_actuals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete restrict,
  job_id uuid not null references public.jobs(id) on delete restrict,
  estimate_snapshot_id uuid not null references public.estimate_snapshot(id) on delete restrict,
  actual_labor_hours numeric not null default 0 check (actual_labor_hours >= 0),
  actual_paint_gallons numeric not null default 0 check (actual_paint_gallons >= 0),
  actual_supplies_cost numeric not null default 0 check (actual_supplies_cost >= 0),
  actual_other_cost numeric not null default 0 check (actual_other_cost >= 0),
  notes text null,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'locked')),
  submitted_at timestamptz null,
  locked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint job_actuals_snapshot_scope_fkey
    foreign key (estimate_snapshot_id, org_id, job_id)
    references public.estimate_snapshot (id, org_id, job_id)
    on delete restrict,
  constraint job_actuals_org_job_snapshot_uniq
    unique (org_id, job_id, estimate_snapshot_id),
  constraint job_actuals_submitted_at_status_check
    check (status = 'draft' or submitted_at is not null),
  constraint job_actuals_locked_at_status_check
    check (status <> 'locked' or locked_at is not null)
);

create index if not exists job_actuals_org_job_idx
  on public.job_actuals (org_id, job_id, updated_at desc);

create index if not exists job_actuals_org_snapshot_idx
  on public.job_actuals (org_id, estimate_snapshot_id);

create or replace function public.prevent_locked_job_actual_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'locked' then
    raise exception 'locked job actuals are immutable'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_job_actuals_prevent_locked_update on public.job_actuals;
create trigger trg_job_actuals_prevent_locked_update
before update on public.job_actuals
for each row execute function public.prevent_locked_job_actual_mutation();

drop trigger if exists trg_job_actuals_prevent_locked_delete on public.job_actuals;
create trigger trg_job_actuals_prevent_locked_delete
before delete on public.job_actuals
for each row execute function public.prevent_locked_job_actual_mutation();

drop trigger if exists trg_job_actuals_set_updated_at on public.job_actuals;
create trigger trg_job_actuals_set_updated_at
before update on public.job_actuals
for each row execute function public.set_updated_at();

alter table public.job_actuals enable row level security;

drop policy if exists job_actuals_select on public.job_actuals;
create policy job_actuals_select
  on public.job_actuals
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_actuals.org_id
    )
  );

drop policy if exists job_actuals_insert on public.job_actuals;
create policy job_actuals_insert
  on public.job_actuals
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_actuals.org_id
    )
  );

drop policy if exists job_actuals_update on public.job_actuals;
create policy job_actuals_update
  on public.job_actuals
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_actuals.org_id
    )
  )
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_actuals.org_id
    )
  );

revoke all on table public.job_actuals from public;
revoke all on table public.job_actuals from anon;
grant select, insert, update on table public.job_actuals to authenticated;
grant select, insert, update, delete on table public.job_actuals to service_role;
