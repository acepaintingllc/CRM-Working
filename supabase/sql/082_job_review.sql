-- Job review comparison layer for estimate feedback.
-- Reviews compare immutable estimate snapshots to submitted/locked actuals.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_actuals_identity_scope_uniq'
      and conrelid = 'public.job_actuals'::regclass
  ) then
    alter table public.job_actuals
      add constraint job_actuals_identity_scope_uniq
      unique (id, org_id, job_id, estimate_snapshot_id);
  end if;
end;
$$;

create table if not exists public.job_review (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete restrict,
  job_id uuid not null references public.jobs(id) on delete restrict,
  estimate_snapshot_id uuid not null references public.estimate_snapshot(id) on delete restrict,
  job_actuals_id uuid not null references public.job_actuals(id) on delete restrict,
  primary_cause_tag text null,
  review_notes text null,
  status text not null default 'draft' check (status in ('draft', 'reviewed', 'locked')),
  exclude_from_trends boolean not null default false,
  data_quality_status text not null default 'valid'
    check (data_quality_status in ('valid', 'questionable', 'invalid')),
  change_order_present boolean not null default false,
  trend_eligible boolean generated always as (
    status = 'locked'
    and data_quality_status = 'valid'
    and exclude_from_trends = false
  ) stored,
  reviewed_at timestamptz null,
  locked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint job_review_snapshot_scope_fkey
    foreign key (estimate_snapshot_id, org_id, job_id)
    references public.estimate_snapshot (id, org_id, job_id)
    on delete restrict,
  constraint job_review_actuals_scope_fkey
    foreign key (job_actuals_id, org_id, job_id, estimate_snapshot_id)
    references public.job_actuals (id, org_id, job_id, estimate_snapshot_id)
    on delete restrict,
  constraint job_review_org_job_snapshot_uniq
    unique (org_id, job_id, estimate_snapshot_id),
  constraint job_review_identity_scope_uniq
    unique (id, org_id, job_id, estimate_snapshot_id),
  constraint job_review_reviewed_at_status_check
    check (status = 'draft' or reviewed_at is not null),
  constraint job_review_locked_at_status_check
    check (status <> 'locked' or locked_at is not null)
);

create table if not exists public.job_review_metric (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete restrict,
  job_id uuid not null references public.jobs(id) on delete restrict,
  estimate_snapshot_id uuid not null references public.estimate_snapshot(id) on delete restrict,
  job_review_id uuid not null references public.job_review(id) on delete restrict,
  metric_key text not null
    check (metric_key in ('labor', 'paint', 'supplies', 'other')),
  metric_label text not null,
  unit text not null check (unit in ('hours', 'gallons', 'currency')),
  estimated_value numeric not null default 0,
  actual_value numeric not null default 0,
  variance_value numeric not null default 0,
  total_impact numeric not null default 0,
  variance_percent numeric null,
  -- Keep aligned with JOB_REVIEW_METRIC_TOLERANCE_PERCENT.
  tolerance_percent numeric not null default 10,
  within_tolerance boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_review_metric_review_scope_fkey
    foreign key (job_review_id, org_id, job_id, estimate_snapshot_id)
    references public.job_review (id, org_id, job_id, estimate_snapshot_id)
    on delete cascade,
  unique (job_review_id, metric_key)
);

create index if not exists job_review_org_job_idx
  on public.job_review (org_id, job_id, updated_at desc);

create index if not exists job_review_trend_eligible_idx
  on public.job_review (org_id, locked_at desc)
  where trend_eligible = true;

create index if not exists job_review_metric_review_idx
  on public.job_review_metric (job_review_id, metric_key);

create or replace function public.prevent_locked_job_review_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'locked' then
    raise exception 'locked job review is immutable'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_job_review_prevent_locked_update on public.job_review;
create trigger trg_job_review_prevent_locked_update
before update on public.job_review
for each row execute function public.prevent_locked_job_review_mutation();

drop trigger if exists trg_job_review_prevent_locked_delete on public.job_review;
create trigger trg_job_review_prevent_locked_delete
before delete on public.job_review
for each row execute function public.prevent_locked_job_review_mutation();

create or replace function public.prevent_locked_job_review_metric_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status text;
begin
  select status
    into v_status
    from public.job_review
    where id = coalesce(old.job_review_id, new.job_review_id);

  if v_status = 'locked' then
    raise exception 'locked job review metrics are immutable'
      using errcode = '55000';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_job_review_metric_prevent_locked_update on public.job_review_metric;
create trigger trg_job_review_metric_prevent_locked_update
before update on public.job_review_metric
for each row execute function public.prevent_locked_job_review_metric_mutation();

drop trigger if exists trg_job_review_metric_prevent_locked_delete on public.job_review_metric;
create trigger trg_job_review_metric_prevent_locked_delete
before delete on public.job_review_metric
for each row execute function public.prevent_locked_job_review_metric_mutation();

drop trigger if exists trg_job_review_set_updated_at on public.job_review;
create trigger trg_job_review_set_updated_at
before update on public.job_review
for each row execute function public.set_updated_at();

drop trigger if exists trg_job_review_metric_set_updated_at on public.job_review_metric;
create trigger trg_job_review_metric_set_updated_at
before update on public.job_review_metric
for each row execute function public.set_updated_at();

alter table public.job_review enable row level security;
alter table public.job_review_metric enable row level security;

drop policy if exists job_review_select on public.job_review;
create policy job_review_select
  on public.job_review
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_review.org_id
    )
  );

drop policy if exists job_review_insert on public.job_review;
create policy job_review_insert
  on public.job_review
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_review.org_id
    )
  );

drop policy if exists job_review_update on public.job_review;
create policy job_review_update
  on public.job_review
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_review.org_id
    )
  )
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_review.org_id
    )
  );

drop policy if exists job_review_metric_select on public.job_review_metric;
create policy job_review_metric_select
  on public.job_review_metric
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_review_metric.org_id
    )
  );

revoke all on table public.job_review from public;
revoke all on table public.job_review from anon;
grant select, insert, update on table public.job_review to authenticated;
grant select, insert, update, delete on table public.job_review to service_role;

revoke all on table public.job_review_metric from public;
revoke all on table public.job_review_metric from anon;
grant select on table public.job_review_metric to authenticated;
grant select, insert, update, delete on table public.job_review_metric to service_role;
