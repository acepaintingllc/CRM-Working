-- Estimator v2 walls-first stage A schema (additive)

alter table public.estimate_jobsettings
  add column if not exists paint_supplied_by text,
  add column if not exists crew_size numeric;

alter table public.estimate_rooms
  add column if not exists room_type_id text,
  add column if not exists paint_supplied_by text,
  add column if not exists doors_include text,
  add column if not exists drywall_include text,
  add column if not exists wall_primer_coats numeric,
  add column if not exists wall_spot_prime_pct numeric,
  add column if not exists wall_complexity_id text,
  add column if not exists notes text;

create table if not exists public.estimate_job_colors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  position int not null default 0,
  color_id text not null,
  color_name text null,
  roller_cover_id text null,
  roller_cover_qty numeric null,
  active text not null default 'Y' check (active in ('Y', 'N')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists estimate_job_colors_org_id_idx on public.estimate_job_colors (org_id);
create index if not exists estimate_job_colors_estimate_id_idx
  on public.estimate_job_colors (org_id, estimate_id, position);
create index if not exists estimate_job_colors_job_id_idx on public.estimate_job_colors (org_id, job_id);

create table if not exists public.estimate_room_flags (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  position int not null default 0,
  room_id text not null,
  flag_id text not null,
  active text not null default 'Y' check (active in ('Y', 'N')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists estimate_room_flags_org_id_idx on public.estimate_room_flags (org_id);
create index if not exists estimate_room_flags_estimate_id_idx
  on public.estimate_room_flags (org_id, estimate_id, position);
create index if not exists estimate_room_flags_job_id_idx on public.estimate_room_flags (org_id, job_id);

create table if not exists public.estimate_access_fees (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  position int not null default 0,
  room_id text not null,
  segment_num numeric null,
  access_fee_id text not null,
  qty numeric not null default 1 check (qty > 0),
  active text not null default 'Y' check (active in ('Y', 'N')),
  notes text null,
  actual_cost_override numeric null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists estimate_access_fees_org_id_idx on public.estimate_access_fees (org_id);
create index if not exists estimate_access_fees_estimate_id_idx
  on public.estimate_access_fees (org_id, estimate_id, position);
create index if not exists estimate_access_fees_job_id_idx on public.estimate_access_fees (org_id, job_id);

alter table public.estimate_job_colors enable row level security;
alter table public.estimate_room_flags enable row level security;
alter table public.estimate_access_fees enable row level security;

drop trigger if exists trg_estimate_job_colors_set_updated_at on public.estimate_job_colors;
create trigger trg_estimate_job_colors_set_updated_at
before update on public.estimate_job_colors
for each row
execute function public.set_updated_at();

drop trigger if exists trg_estimate_room_flags_set_updated_at on public.estimate_room_flags;
create trigger trg_estimate_room_flags_set_updated_at
before update on public.estimate_room_flags
for each row
execute function public.set_updated_at();

drop trigger if exists trg_estimate_access_fees_set_updated_at on public.estimate_access_fees;
create trigger trg_estimate_access_fees_set_updated_at
before update on public.estimate_access_fees
for each row
execute function public.set_updated_at();

drop policy if exists "estimate_job_colors_select" on public.estimate_job_colors;
create policy "estimate_job_colors_select"
  on public.estimate_job_colors
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_job_colors.org_id
    )
  );

drop policy if exists "estimate_job_colors_insert" on public.estimate_job_colors;
create policy "estimate_job_colors_insert"
  on public.estimate_job_colors
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_job_colors.org_id
    )
  );

drop policy if exists "estimate_job_colors_update" on public.estimate_job_colors;
create policy "estimate_job_colors_update"
  on public.estimate_job_colors
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_job_colors.org_id
    )
  );

drop policy if exists "estimate_job_colors_delete" on public.estimate_job_colors;
create policy "estimate_job_colors_delete"
  on public.estimate_job_colors
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_job_colors.org_id
    )
  );

drop policy if exists "estimate_room_flags_select" on public.estimate_room_flags;
create policy "estimate_room_flags_select"
  on public.estimate_room_flags
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_room_flags.org_id
    )
  );

drop policy if exists "estimate_room_flags_insert" on public.estimate_room_flags;
create policy "estimate_room_flags_insert"
  on public.estimate_room_flags
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_room_flags.org_id
    )
  );

drop policy if exists "estimate_room_flags_update" on public.estimate_room_flags;
create policy "estimate_room_flags_update"
  on public.estimate_room_flags
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_room_flags.org_id
    )
  );

drop policy if exists "estimate_room_flags_delete" on public.estimate_room_flags;
create policy "estimate_room_flags_delete"
  on public.estimate_room_flags
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_room_flags.org_id
    )
  );

drop policy if exists "estimate_access_fees_select" on public.estimate_access_fees;
create policy "estimate_access_fees_select"
  on public.estimate_access_fees
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_access_fees.org_id
    )
  );

drop policy if exists "estimate_access_fees_insert" on public.estimate_access_fees;
create policy "estimate_access_fees_insert"
  on public.estimate_access_fees
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_access_fees.org_id
    )
  );

drop policy if exists "estimate_access_fees_update" on public.estimate_access_fees;
create policy "estimate_access_fees_update"
  on public.estimate_access_fees
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_access_fees.org_id
    )
  );

drop policy if exists "estimate_access_fees_delete" on public.estimate_access_fees;
create policy "estimate_access_fees_delete"
  on public.estimate_access_fees
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_access_fees.org_id
    )
  );
