-- Estimates module: DB persistence + RLS + private workbook storage metadata.

create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'ready', 'recalculated', 'error')),
  sheet_schema_version text null,
  sheet_file_path text null,
  latest_output_json jsonb null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- If public.estimates already existed, CREATE TABLE IF NOT EXISTS will not add new columns.
-- Ensure required columns exist before creating indexes/policies.
alter table public.estimates add column if not exists customer_id uuid;
alter table public.estimates add column if not exists status text default 'draft';
alter table public.estimates add column if not exists sheet_schema_version text;
alter table public.estimates add column if not exists sheet_file_path text;
alter table public.estimates add column if not exists latest_output_json jsonb;
alter table public.estimates add column if not exists created_by uuid;
alter table public.estimates add column if not exists created_at timestamptz default now();
alter table public.estimates add column if not exists updated_at timestamptz default now();

-- Remove legacy columns from old estimates schema variants.
alter table public.estimates drop column if exists file_path;
alter table public.estimates drop column if exists version;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'estimates_customer_id_fkey'
      and conrelid = 'public.estimates'::regclass
  ) then
    alter table public.estimates
      add constraint estimates_customer_id_fkey
      foreign key (customer_id) references public.customers(id) on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'estimates_status_check'
      and conrelid = 'public.estimates'::regclass
  ) then
    alter table public.estimates
      add constraint estimates_status_check
      check (status in ('draft', 'ready', 'recalculated', 'error'));
  end if;

end $$;

create index if not exists estimates_org_id_idx on public.estimates (org_id);
create index if not exists estimates_estimate_id_idx on public.estimates (org_id, id);
create index if not exists estimates_job_id_idx on public.estimates (org_id, job_id);
create index if not exists estimates_customer_id_idx on public.estimates (org_id, customer_id);

create table if not exists public.estimate_jobsettings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  walls_paint_id text null,
  ceiling_paint_id text null,
  trim_paint_id text null,
  primer_id text null,
  override_labor_rate numeric null,
  override_markup numeric null,
  rounding_increment_hours numeric null,
  dayhours numeric null,
  default_walls_prep_level text null,
  default_ceiling_prep_level text null,
  notes text null,
  walls_paint_gal_override numeric null,
  ceiling_paint_gal_override numeric null,
  primer_gal_override numeric null,
  extra_supplies_walls numeric null,
  extra_supplies_ceilings numeric null,
  extra_supplies_trim numeric null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, estimate_id)
);

create index if not exists estimate_jobsettings_org_id_idx on public.estimate_jobsettings (org_id);
create index if not exists estimate_jobsettings_estimate_id_idx on public.estimate_jobsettings (org_id, estimate_id);
create index if not exists estimate_jobsettings_job_id_idx on public.estimate_jobsettings (org_id, job_id);
alter table public.estimate_jobsettings add column if not exists default_walls_prep_level text;
alter table public.estimate_jobsettings add column if not exists default_ceiling_prep_level text;

create table if not exists public.estimate_rooms (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  position int not null default 0,
  room_id text null,
  room_name text not null,
  mode text not null default 'RECT' check (mode in ('RECT', 'SEG')),
  length_in numeric null,
  width_in numeric null,
  wallheight_in numeric null,
  ceilingheight_in numeric null,
  ceilingsqft_override numeric null,
  baseexclude_in numeric null,
  walls_include text not null default 'Y' check (walls_include in ('Y', 'N')),
  walls_primer text null,
  walls_topcoats numeric null,
  walls_prep_override text null,
  ceiling_include text not null default 'N' check (ceiling_include in ('Y', 'N')),
  ceiling_primer text null,
  ceiling_topcoats numeric null,
  ceiling_prep_override text null,
  ceiling_height_surcharge numeric null,
  trim_include text not null default 'N' check (trim_include in ('Y', 'N')),
  trim_primer text null,
  trim_topcoats numeric null,
  trim_prep_override text null,
  paint_base text null,
  paint_crown text null,
  paint_window_casing text null,
  paint_door_casing text null,
  paint_doors text null,
  wall_color_id text null,
  ceiling_type_id text null,
  door_count numeric null,
  window_count numeric null,
  baseboard_lf numeric null,
  crown_lf numeric null,
  baseboard_type_id text null,
  baseboard_auto text not null default 'N' check (baseboard_auto in ('Y', 'N')),
  crown_type_id text null,
  crown_auto text not null default 'N' check (crown_auto in ('Y', 'N')),
  window_casing_type_id text null,
  door_casing_type_id text null,
  door_casing_count numeric null,
  door_type_id text null,
  door_paint_count numeric null,
  door_sides numeric null,
  auto_calc_trim_perimeter text not null default 'N' check (auto_calc_trim_perimeter in ('Y', 'N')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.estimate_rooms add column if not exists door_count numeric;
alter table public.estimate_rooms add column if not exists window_count numeric;
alter table public.estimate_rooms add column if not exists baseboard_lf numeric;
alter table public.estimate_rooms add column if not exists crown_lf numeric;
alter table public.estimate_rooms add column if not exists baseboard_type_id text;
alter table public.estimate_rooms add column if not exists baseboard_auto text default 'N';
alter table public.estimate_rooms add column if not exists crown_type_id text;
alter table public.estimate_rooms add column if not exists crown_auto text default 'N';
alter table public.estimate_rooms add column if not exists window_casing_type_id text;
alter table public.estimate_rooms add column if not exists door_casing_type_id text;
alter table public.estimate_rooms add column if not exists door_casing_count numeric;
alter table public.estimate_rooms add column if not exists door_type_id text;
alter table public.estimate_rooms add column if not exists door_paint_count numeric;
alter table public.estimate_rooms add column if not exists door_sides numeric;
alter table public.estimate_rooms add column if not exists auto_calc_trim_perimeter text default 'N';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'estimate_rooms'
      and column_name = 'auto_calc_trim_perimeter'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'estimate_rooms_auto_calc_trim_perimeter_check'
      and conrelid = 'public.estimate_rooms'::regclass
  ) then
    alter table public.estimate_rooms
      add constraint estimate_rooms_auto_calc_trim_perimeter_check
      check (auto_calc_trim_perimeter in ('Y', 'N'));
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'estimate_rooms'
      and column_name = 'baseboard_auto'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'estimate_rooms_baseboard_auto_check'
      and conrelid = 'public.estimate_rooms'::regclass
  ) then
    alter table public.estimate_rooms
      add constraint estimate_rooms_baseboard_auto_check
      check (baseboard_auto in ('Y', 'N'));
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'estimate_rooms'
      and column_name = 'crown_auto'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'estimate_rooms_crown_auto_check'
      and conrelid = 'public.estimate_rooms'::regclass
  ) then
    alter table public.estimate_rooms
      add constraint estimate_rooms_crown_auto_check
      check (crown_auto in ('Y', 'N'));
  end if;
end $$;

create index if not exists estimate_rooms_org_id_idx on public.estimate_rooms (org_id);
create index if not exists estimate_rooms_estimate_id_idx on public.estimate_rooms (org_id, estimate_id, position);
create index if not exists estimate_rooms_job_id_idx on public.estimate_rooms (org_id, job_id);

create table if not exists public.estimate_segments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  position int not null default 0,
  room_id text null,
  seg_no int null,
  seglen_in numeric null,
  baseexclude_in numeric null,
  notes text null,
  wall_label text null,
  wall_color_override_id text null,
  active text not null default 'Y' check (active in ('Y', 'N')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists estimate_segments_org_id_idx on public.estimate_segments (org_id);
create index if not exists estimate_segments_estimate_id_idx on public.estimate_segments (org_id, estimate_id, position);
create index if not exists estimate_segments_job_id_idx on public.estimate_segments (org_id, job_id);

create table if not exists public.estimate_rollers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  position int not null default 0,
  scope text not null check (scope in ('Wall', 'Ceiling')),
  wall_color_id text null,
  roller_size_in numeric null,
  covers_qty numeric null,
  notes text null,
  active text not null default 'Y' check (active in ('Y', 'N')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists estimate_rollers_org_id_idx on public.estimate_rollers (org_id);
create index if not exists estimate_rollers_estimate_id_idx on public.estimate_rollers (org_id, estimate_id, position);
create index if not exists estimate_rollers_job_id_idx on public.estimate_rollers (org_id, job_id);

create table if not exists public.estimate_prejob (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  position int not null default 0,
  category text null,
  trip_name text null,
  qty numeric null,
  hours_each numeric null,
  laborrate numeric null,
  markup numeric null,
  notes text null,
  active text not null default 'Y' check (active in ('Y', 'N')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists estimate_prejob_org_id_idx on public.estimate_prejob (org_id);
create index if not exists estimate_prejob_estimate_id_idx on public.estimate_prejob (org_id, estimate_id, position);
create index if not exists estimate_prejob_job_id_idx on public.estimate_prejob (org_id, job_id);

create table if not exists public.estimate_trim_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  position int not null default 0,
  room_id text null,
  trim_item_id text not null,
  qty numeric null,
  unit text null,
  notes text null,
  active text not null default 'Y' check (active in ('Y', 'N')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists estimate_trim_lines_org_id_idx on public.estimate_trim_lines (org_id);
create index if not exists estimate_trim_lines_estimate_id_idx on public.estimate_trim_lines (org_id, estimate_id, position);
create index if not exists estimate_trim_lines_job_id_idx on public.estimate_trim_lines (org_id, job_id);

create table if not exists public.estimate_trim_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  room_id text null,
  trim_menu_id text not null,
  qty numeric null,
  coats numeric null,
  auto_calc text null,
  primer_mode text null,
  prep_level_override text null,
  door_sides numeric null,
  notes text null,
  active text not null default 'Y' check (active in ('Y', 'N')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists estimate_trim_items_org_id_idx on public.estimate_trim_items (org_id);
create index if not exists estimate_trim_items_estimate_id_idx on public.estimate_trim_items (org_id, estimate_id, sort_order);
create index if not exists estimate_trim_items_job_id_idx on public.estimate_trim_items (org_id, job_id);
alter table public.estimate_trim_items add column if not exists prep_level_override text;
alter table public.estimate_trim_items add column if not exists door_sides numeric;
alter table public.estimate_trim_items add column if not exists primer_mode text;
alter table public.estimate_trim_items add column if not exists coats numeric;
alter table public.estimate_trim_items add column if not exists auto_calc text;

alter table public.estimates enable row level security;
alter table public.estimate_jobsettings enable row level security;
alter table public.estimate_rooms enable row level security;
alter table public.estimate_segments enable row level security;
alter table public.estimate_rollers enable row level security;
alter table public.estimate_prejob enable row level security;
alter table public.estimate_trim_lines enable row level security;
alter table public.estimate_trim_items enable row level security;

drop trigger if exists trg_estimates_set_updated_at on public.estimates;
create trigger trg_estimates_set_updated_at
before update on public.estimates
for each row
execute function public.set_updated_at();

drop trigger if exists trg_estimate_jobsettings_set_updated_at on public.estimate_jobsettings;
create trigger trg_estimate_jobsettings_set_updated_at
before update on public.estimate_jobsettings
for each row
execute function public.set_updated_at();

drop trigger if exists trg_estimate_rooms_set_updated_at on public.estimate_rooms;
create trigger trg_estimate_rooms_set_updated_at
before update on public.estimate_rooms
for each row
execute function public.set_updated_at();

drop trigger if exists trg_estimate_segments_set_updated_at on public.estimate_segments;
create trigger trg_estimate_segments_set_updated_at
before update on public.estimate_segments
for each row
execute function public.set_updated_at();

drop trigger if exists trg_estimate_rollers_set_updated_at on public.estimate_rollers;
create trigger trg_estimate_rollers_set_updated_at
before update on public.estimate_rollers
for each row
execute function public.set_updated_at();

drop trigger if exists trg_estimate_prejob_set_updated_at on public.estimate_prejob;
create trigger trg_estimate_prejob_set_updated_at
before update on public.estimate_prejob
for each row
execute function public.set_updated_at();

drop trigger if exists trg_estimate_trim_lines_set_updated_at on public.estimate_trim_lines;
create trigger trg_estimate_trim_lines_set_updated_at
before update on public.estimate_trim_lines
for each row
execute function public.set_updated_at();

drop trigger if exists trg_estimate_trim_items_set_updated_at on public.estimate_trim_items;
create trigger trg_estimate_trim_items_set_updated_at
before update on public.estimate_trim_items
for each row
execute function public.set_updated_at();

drop policy if exists "estimates_select" on public.estimates;

create policy "estimates_select"
  on public.estimates
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimates.org_id
    )
  );

drop policy if exists "estimates_insert" on public.estimates;

create policy "estimates_insert"
  on public.estimates
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimates.org_id
    )
  );

drop policy if exists "estimates_update" on public.estimates;

create policy "estimates_update"
  on public.estimates
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimates.org_id
    )
  );

drop policy if exists "estimates_delete" on public.estimates;

create policy "estimates_delete"
  on public.estimates
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimates.org_id
    )
  );

drop policy if exists "estimate_jobsettings_select" on public.estimate_jobsettings;

create policy "estimate_jobsettings_select"
  on public.estimate_jobsettings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_jobsettings.org_id
    )
  );

drop policy if exists "estimate_jobsettings_insert" on public.estimate_jobsettings;

create policy "estimate_jobsettings_insert"
  on public.estimate_jobsettings
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_jobsettings.org_id
    )
  );

drop policy if exists "estimate_jobsettings_update" on public.estimate_jobsettings;

create policy "estimate_jobsettings_update"
  on public.estimate_jobsettings
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_jobsettings.org_id
    )
  );

drop policy if exists "estimate_jobsettings_delete" on public.estimate_jobsettings;

create policy "estimate_jobsettings_delete"
  on public.estimate_jobsettings
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_jobsettings.org_id
    )
  );

drop policy if exists "estimate_rooms_select" on public.estimate_rooms;

create policy "estimate_rooms_select"
  on public.estimate_rooms
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_rooms.org_id
    )
  );

drop policy if exists "estimate_rooms_insert" on public.estimate_rooms;

create policy "estimate_rooms_insert"
  on public.estimate_rooms
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_rooms.org_id
    )
  );

drop policy if exists "estimate_rooms_update" on public.estimate_rooms;

create policy "estimate_rooms_update"
  on public.estimate_rooms
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_rooms.org_id
    )
  );

drop policy if exists "estimate_rooms_delete" on public.estimate_rooms;

create policy "estimate_rooms_delete"
  on public.estimate_rooms
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_rooms.org_id
    )
  );

drop policy if exists "estimate_segments_select" on public.estimate_segments;

create policy "estimate_segments_select"
  on public.estimate_segments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_segments.org_id
    )
  );

drop policy if exists "estimate_segments_insert" on public.estimate_segments;

create policy "estimate_segments_insert"
  on public.estimate_segments
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_segments.org_id
    )
  );

drop policy if exists "estimate_segments_update" on public.estimate_segments;

create policy "estimate_segments_update"
  on public.estimate_segments
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_segments.org_id
    )
  );

drop policy if exists "estimate_segments_delete" on public.estimate_segments;

create policy "estimate_segments_delete"
  on public.estimate_segments
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_segments.org_id
    )
  );

drop policy if exists "estimate_rollers_select" on public.estimate_rollers;

create policy "estimate_rollers_select"
  on public.estimate_rollers
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_rollers.org_id
    )
  );

drop policy if exists "estimate_rollers_insert" on public.estimate_rollers;

create policy "estimate_rollers_insert"
  on public.estimate_rollers
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_rollers.org_id
    )
  );

drop policy if exists "estimate_rollers_update" on public.estimate_rollers;

create policy "estimate_rollers_update"
  on public.estimate_rollers
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_rollers.org_id
    )
  );

drop policy if exists "estimate_rollers_delete" on public.estimate_rollers;

create policy "estimate_rollers_delete"
  on public.estimate_rollers
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_rollers.org_id
    )
  );

drop policy if exists "estimate_prejob_select" on public.estimate_prejob;

create policy "estimate_prejob_select"
  on public.estimate_prejob
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_prejob.org_id
    )
  );

drop policy if exists "estimate_prejob_insert" on public.estimate_prejob;

create policy "estimate_prejob_insert"
  on public.estimate_prejob
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_prejob.org_id
    )
  );

drop policy if exists "estimate_prejob_update" on public.estimate_prejob;

create policy "estimate_prejob_update"
  on public.estimate_prejob
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_prejob.org_id
    )
  );

drop policy if exists "estimate_prejob_delete" on public.estimate_prejob;

create policy "estimate_prejob_delete"
  on public.estimate_prejob
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_prejob.org_id
    )
  );

drop policy if exists "estimate_trim_lines_select" on public.estimate_trim_lines;

create policy "estimate_trim_lines_select"
  on public.estimate_trim_lines
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_trim_lines.org_id
    )
  );

drop policy if exists "estimate_trim_lines_insert" on public.estimate_trim_lines;

create policy "estimate_trim_lines_insert"
  on public.estimate_trim_lines
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_trim_lines.org_id
    )
  );

drop policy if exists "estimate_trim_lines_update" on public.estimate_trim_lines;

create policy "estimate_trim_lines_update"
  on public.estimate_trim_lines
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_trim_lines.org_id
    )
  );

drop policy if exists "estimate_trim_lines_delete" on public.estimate_trim_lines;

create policy "estimate_trim_lines_delete"
  on public.estimate_trim_lines
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_trim_lines.org_id
    )
  );

drop policy if exists "estimate_trim_items_select" on public.estimate_trim_items;

create policy "estimate_trim_items_select"
  on public.estimate_trim_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_trim_items.org_id
    )
  );

drop policy if exists "estimate_trim_items_insert" on public.estimate_trim_items;

create policy "estimate_trim_items_insert"
  on public.estimate_trim_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_trim_items.org_id
    )
  );

drop policy if exists "estimate_trim_items_update" on public.estimate_trim_items;

create policy "estimate_trim_items_update"
  on public.estimate_trim_items
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_trim_items.org_id
    )
  );

drop policy if exists "estimate_trim_items_delete" on public.estimate_trim_items;

create policy "estimate_trim_items_delete"
  on public.estimate_trim_items
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_trim_items.org_id
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'estimate-workbooks',
  'estimate-workbooks',
  false,
  52428800,
  array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do nothing;
