-- Per-color settings for simple wall estimates
create table if not exists public.job_simple_wall_color_groups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  color_group text not null,
  roller_nap text null,
  extra_setup_minutes numeric null,
  extra_supplies_allowance numeric null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, job_id, color_group)
);

create index if not exists job_simple_wall_color_groups_org_idx
  on public.job_simple_wall_color_groups (org_id);
create index if not exists job_simple_wall_color_groups_job_idx
  on public.job_simple_wall_color_groups (org_id, job_id, color_group);

alter table public.job_simple_wall_color_groups enable row level security;

drop trigger if exists trg_job_simple_wall_color_groups_set_updated_at on public.job_simple_wall_color_groups;
create trigger trg_job_simple_wall_color_groups_set_updated_at
before update on public.job_simple_wall_color_groups
for each row
execute function public.set_updated_at();

create policy "job_simple_wall_color_groups_select"
  on public.job_simple_wall_color_groups
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_simple_wall_color_groups.org_id
    )
  );

create policy "job_simple_wall_color_groups_insert"
  on public.job_simple_wall_color_groups
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_simple_wall_color_groups.org_id
    )
  );

create policy "job_simple_wall_color_groups_update"
  on public.job_simple_wall_color_groups
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_simple_wall_color_groups.org_id
    )
  );

create policy "job_simple_wall_color_groups_delete"
  on public.job_simple_wall_color_groups
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_simple_wall_color_groups.org_id
    )
  );
