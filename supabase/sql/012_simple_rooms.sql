-- Shared room geometry + section toggles for simple estimates
create table if not exists public.job_simple_rooms (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  position int not null,
  room_name text not null,
  length_ft numeric not null,
  width_ft numeric not null,
  height_ft numeric not null,
  include_walls boolean not null default true,
  include_ceilings boolean not null default false,
  include_trim boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_simple_rooms_org_idx
  on public.job_simple_rooms (org_id);
create index if not exists job_simple_rooms_job_idx
  on public.job_simple_rooms (org_id, job_id, position);

alter table public.job_simple_rooms enable row level security;

drop trigger if exists trg_job_simple_rooms_set_updated_at on public.job_simple_rooms;
create trigger trg_job_simple_rooms_set_updated_at
before update on public.job_simple_rooms
for each row
execute function public.set_updated_at();

create policy "job_simple_rooms_select"
  on public.job_simple_rooms
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_simple_rooms.org_id
    )
  );

create policy "job_simple_rooms_insert"
  on public.job_simple_rooms
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_simple_rooms.org_id
    )
  );

create policy "job_simple_rooms_update"
  on public.job_simple_rooms
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_simple_rooms.org_id
    )
  );

create policy "job_simple_rooms_delete"
  on public.job_simple_rooms
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_simple_rooms.org_id
    )
  );

