-- Trim paint selections (paint product + gallons input)
create table if not exists public.job_simple_trim_paints (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  position int not null,
  paint_product text not null,
  gallons_input numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_simple_trim_paints_org_idx
  on public.job_simple_trim_paints (org_id);
create index if not exists job_simple_trim_paints_job_idx
  on public.job_simple_trim_paints (org_id, job_id, position);

alter table public.job_simple_trim_paints enable row level security;

drop trigger if exists trg_job_simple_trim_paints_set_updated_at on public.job_simple_trim_paints;
create trigger trg_job_simple_trim_paints_set_updated_at
before update on public.job_simple_trim_paints
for each row
execute function public.set_updated_at();

create policy "job_simple_trim_paints_select"
  on public.job_simple_trim_paints
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_simple_trim_paints.org_id
    )
  );

create policy "job_simple_trim_paints_insert"
  on public.job_simple_trim_paints
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_simple_trim_paints.org_id
    )
  );

create policy "job_simple_trim_paints_update"
  on public.job_simple_trim_paints
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_simple_trim_paints.org_id
    )
  );

create policy "job_simple_trim_paints_delete"
  on public.job_simple_trim_paints
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_simple_trim_paints.org_id
    )
  );

