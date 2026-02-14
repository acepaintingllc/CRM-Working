-- Simple trim estimate inputs (job defaults + line item activities)
create table if not exists public.job_simple_trim_estimates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  default_prep text not null default 'med',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, job_id)
);

create table if not exists public.job_simple_trim_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  position int not null,
  item_activity text not null,
  quantity numeric not null,
  coats numeric not null,
  prep_override text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_simple_trim_estimates_org_idx
  on public.job_simple_trim_estimates (org_id);
create index if not exists job_simple_trim_estimates_job_idx
  on public.job_simple_trim_estimates (org_id, job_id);

create index if not exists job_simple_trim_items_org_idx
  on public.job_simple_trim_items (org_id);
create index if not exists job_simple_trim_items_job_idx
  on public.job_simple_trim_items (org_id, job_id, position);

alter table public.job_simple_trim_estimates enable row level security;
alter table public.job_simple_trim_items enable row level security;

drop trigger if exists trg_job_simple_trim_estimates_set_updated_at on public.job_simple_trim_estimates;
create trigger trg_job_simple_trim_estimates_set_updated_at
before update on public.job_simple_trim_estimates
for each row
execute function public.set_updated_at();

drop trigger if exists trg_job_simple_trim_items_set_updated_at on public.job_simple_trim_items;
create trigger trg_job_simple_trim_items_set_updated_at
before update on public.job_simple_trim_items
for each row
execute function public.set_updated_at();

create policy "job_simple_trim_estimates_select"
  on public.job_simple_trim_estimates
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_simple_trim_estimates.org_id
    )
  );

create policy "job_simple_trim_estimates_insert"
  on public.job_simple_trim_estimates
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_simple_trim_estimates.org_id
    )
  );

create policy "job_simple_trim_estimates_update"
  on public.job_simple_trim_estimates
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_simple_trim_estimates.org_id
    )
  );

create policy "job_simple_trim_estimates_delete"
  on public.job_simple_trim_estimates
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_simple_trim_estimates.org_id
    )
  );

create policy "job_simple_trim_items_select"
  on public.job_simple_trim_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_simple_trim_items.org_id
    )
  );

create policy "job_simple_trim_items_insert"
  on public.job_simple_trim_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_simple_trim_items.org_id
    )
  );

create policy "job_simple_trim_items_update"
  on public.job_simple_trim_items
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_simple_trim_items.org_id
    )
  );

create policy "job_simple_trim_items_delete"
  on public.job_simple_trim_items
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_simple_trim_items.org_id
    )
  );

