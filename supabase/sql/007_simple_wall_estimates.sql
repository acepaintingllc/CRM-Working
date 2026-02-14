-- Simple wall estimate inputs (job defaults + per-room dimensions/details)
create table if not exists public.job_simple_wall_estimates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  wall_paint_product text null,
  wall_roller_nap text null,
  default_coats numeric not null default 2,
  default_prep text not null default 'med',
  default_extra_setup_minutes numeric null,
  default_extra_supplies_note text null,
  default_extra_supplies_allowance numeric null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, job_id)
);

create table if not exists public.job_simple_wall_rooms (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  position int not null,
  room_name text not null,
  length_ft numeric not null,
  width_ft numeric not null,
  height_ft numeric not null,
  color_group text not null default 'A',
  coats_override numeric null,
  prep_override text null,
  extra_setup_minutes numeric null,
  extra_supplies_note text null,
  extra_supplies_allowance numeric null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_simple_wall_estimates_org_idx
  on public.job_simple_wall_estimates (org_id);
create index if not exists job_simple_wall_estimates_job_idx
  on public.job_simple_wall_estimates (org_id, job_id);

create index if not exists job_simple_wall_rooms_org_idx
  on public.job_simple_wall_rooms (org_id);
create index if not exists job_simple_wall_rooms_job_idx
  on public.job_simple_wall_rooms (org_id, job_id, position);

alter table public.job_simple_wall_estimates enable row level security;
alter table public.job_simple_wall_rooms enable row level security;

drop trigger if exists trg_job_simple_wall_estimates_set_updated_at on public.job_simple_wall_estimates;
create trigger trg_job_simple_wall_estimates_set_updated_at
before update on public.job_simple_wall_estimates
for each row
execute function public.set_updated_at();

drop trigger if exists trg_job_simple_wall_rooms_set_updated_at on public.job_simple_wall_rooms;
create trigger trg_job_simple_wall_rooms_set_updated_at
before update on public.job_simple_wall_rooms
for each row
execute function public.set_updated_at();

create policy "job_simple_wall_estimates_select"
  on public.job_simple_wall_estimates
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_simple_wall_estimates.org_id
    )
  );

create policy "job_simple_wall_estimates_insert"
  on public.job_simple_wall_estimates
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_simple_wall_estimates.org_id
    )
  );

create policy "job_simple_wall_estimates_update"
  on public.job_simple_wall_estimates
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_simple_wall_estimates.org_id
    )
  );

create policy "job_simple_wall_estimates_delete"
  on public.job_simple_wall_estimates
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_simple_wall_estimates.org_id
    )
  );

create policy "job_simple_wall_rooms_select"
  on public.job_simple_wall_rooms
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_simple_wall_rooms.org_id
    )
  );

create policy "job_simple_wall_rooms_insert"
  on public.job_simple_wall_rooms
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_simple_wall_rooms.org_id
    )
  );

create policy "job_simple_wall_rooms_update"
  on public.job_simple_wall_rooms
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_simple_wall_rooms.org_id
    )
  );

create policy "job_simple_wall_rooms_delete"
  on public.job_simple_wall_rooms
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_simple_wall_rooms.org_id
    )
  );
