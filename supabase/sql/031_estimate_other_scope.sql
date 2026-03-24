-- Catch-all estimate scope rows (manual custom work)

create table if not exists public.estimate_other (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  position int not null default 0,
  rollup_scope text not null check (rollup_scope in ('Walls', 'Ceilings', 'Trim')),
  location text null,
  client_description text not null,
  qty numeric not null default 1 check (qty > 0),
  uom text null,
  labor_hrs_each numeric not null default 0 check (labor_hrs_each >= 0),
  materials_each numeric not null default 0 check (materials_each >= 0),
  notes text null,
  active text not null default 'Y' check (active in ('Y', 'N')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists estimate_other_org_id_idx on public.estimate_other (org_id);
create index if not exists estimate_other_estimate_id_idx on public.estimate_other (org_id, estimate_id, position);
create index if not exists estimate_other_job_id_idx on public.estimate_other (org_id, job_id);

alter table public.estimate_other enable row level security;

drop trigger if exists trg_estimate_other_set_updated_at on public.estimate_other;
create trigger trg_estimate_other_set_updated_at
before update on public.estimate_other
for each row
execute function public.set_updated_at();

drop policy if exists "estimate_other_select" on public.estimate_other;
create policy "estimate_other_select"
  on public.estimate_other
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_other.org_id
    )
  );

drop policy if exists "estimate_other_insert" on public.estimate_other;
create policy "estimate_other_insert"
  on public.estimate_other
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_other.org_id
    )
  );

drop policy if exists "estimate_other_update" on public.estimate_other;
create policy "estimate_other_update"
  on public.estimate_other
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_other.org_id
    )
  );

drop policy if exists "estimate_other_delete" on public.estimate_other;
create policy "estimate_other_delete"
  on public.estimate_other
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_other.org_id
    )
  );
