-- Phase 1: Estimator V2 core schema + domain-model persistence
-- This migration establishes the MVP structures that replace the old v2 planning model.
-- It stays additive against the current repo so existing estimate flows do not break while
-- the new in-app estimator is built out.

alter table public.estimates
  add column if not exists version_name text,
  add column if not exists version_state text,
  add column if not exists version_kind text,
  add column if not exists version_sort_order int;

update public.estimates
set
  version_name = coalesce(nullif(btrim(version_name), ''), 'Estimate Version'),
  version_state = coalesce(nullif(btrim(version_state), ''), 'draft'),
  version_kind = coalesce(nullif(btrim(version_kind), ''), 'standard'),
  version_sort_order = coalesce(version_sort_order, 0)
where
  version_name is null or btrim(version_name) = ''
  or version_state is null or btrim(version_state) = ''
  or version_kind is null or btrim(version_kind) = ''
  or version_sort_order is null;

alter table public.estimates
  alter column version_name set default 'Estimate Version',
  alter column version_state set default 'draft',
  alter column version_kind set default 'standard',
  alter column version_sort_order set default 0;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'estimates'
      and column_name = 'version_name'
  ) then
    alter table public.estimates
      alter column version_name set not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'estimates'
      and column_name = 'version_state'
  ) then
    alter table public.estimates
      alter column version_state set not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'estimates'
      and column_name = 'version_kind'
  ) then
    alter table public.estimates
      alter column version_kind set not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'estimates'
      and column_name = 'version_sort_order'
  ) then
    alter table public.estimates
      alter column version_sort_order set not null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'estimates_version_state_check'
      and conrelid = 'public.estimates'::regclass
  ) then
    alter table public.estimates
      add constraint estimates_version_state_check
      check (version_state in ('draft', 'live', 'archived'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'estimates_version_kind_check'
      and conrelid = 'public.estimates'::regclass
  ) then
    alter table public.estimates
      add constraint estimates_version_kind_check
      check (version_kind in ('standard', 'alternate', 'split', 'combined', 'revision'));
  end if;
end $$;

create index if not exists estimates_job_version_state_idx
  on public.estimates (org_id, job_id, version_state);

create index if not exists estimates_job_version_sort_idx
  on public.estimates (org_id, job_id, version_sort_order, created_at);

create table if not exists public.estimate_room_wall_scopes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  room_id text not null,
  position int not null default 0,
  mode text not null default 'RECT' check (mode in ('RECT', 'SEG')),
  include text not null default 'Y' check (include in ('Y', 'N')),
  scope_name text null,
  color_id text null,
  paint_product_id text null,
  primer_product_id text null,
  prime_mode text not null default 'NONE' check (prime_mode in ('NONE', 'SPOT', 'FULL')),
  height_in numeric null,
  perimeter_in numeric null,
  standard_door_count numeric null,
  standard_window_count numeric null,
  height_factor numeric null,
  complexity_factor numeric null,
  wall_flag_factor numeric null,
  cut_in_top_factor numeric null,
  cut_in_bottom_factor numeric null,
  raw_area_sf numeric null,
  override_area_sf numeric null,
  effective_area_sf numeric null,
  raw_paint_hours numeric null,
  override_paint_hours numeric null,
  effective_paint_hours numeric null,
  raw_primer_hours numeric null,
  override_primer_hours numeric null,
  effective_primer_hours numeric null,
  raw_paint_gallons numeric null,
  override_paint_gallons numeric null,
  effective_paint_gallons numeric null,
  raw_primer_gallons numeric null,
  override_primer_gallons numeric null,
  effective_primer_gallons numeric null,
  raw_supply_cost numeric null,
  override_supply_cost numeric null,
  effective_supply_cost numeric null,
  raw_total numeric null,
  override_total numeric null,
  effective_total numeric null,
  notes text null,
  active text not null default 'Y' check (active in ('Y', 'N')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists estimate_room_wall_scopes_org_id_idx
  on public.estimate_room_wall_scopes (org_id);

create index if not exists estimate_room_wall_scopes_estimate_id_idx
  on public.estimate_room_wall_scopes (org_id, estimate_id, room_id, position);

create index if not exists estimate_room_wall_scopes_job_id_idx
  on public.estimate_room_wall_scopes (org_id, job_id);

create unique index if not exists estimate_room_wall_scopes_active_rect_key
  on public.estimate_room_wall_scopes (org_id, estimate_id, room_id)
  where active = 'Y'
    and mode = 'RECT'
    and room_id is not null
    and btrim(room_id) <> '';

alter table public.estimate_segments
  add column if not exists wall_scope_id uuid references public.estimate_room_wall_scopes(id) on delete cascade,
  add column if not exists segment_name text,
  add column if not exists shape_type text,
  add column if not exists quantity numeric,
  add column if not exists width_in numeric,
  add column if not exists height_in numeric,
  add column if not exists base_in numeric,
  add column if not exists manual_area_sf numeric,
  add column if not exists standard_door_count numeric,
  add column if not exists standard_window_count numeric,
  add column if not exists include text,
  add column if not exists raw_area_sf numeric,
  add column if not exists override_area_sf numeric,
  add column if not exists effective_area_sf numeric;

update public.estimate_segments
set
  segment_name = coalesce(nullif(btrim(segment_name), ''), nullif(btrim(wall_label), '')),
  shape_type = coalesce(nullif(btrim(shape_type), ''), 'RECTANGLE'),
  quantity = coalesce(quantity, 1),
  width_in = coalesce(width_in, seglen_in),
  height_in = coalesce(height_in, seg_wallheight_in),
  include = coalesce(nullif(btrim(include), ''), 'Y')
where
  segment_name is null or btrim(segment_name) = ''
  or shape_type is null or btrim(shape_type) = ''
  or quantity is null
  or width_in is null
  or height_in is null
  or include is null or btrim(include) = '';

alter table public.estimate_segments
  alter column shape_type set default 'RECTANGLE',
  alter column quantity set default 1,
  alter column include set default 'Y';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'estimate_segments_shape_type_check'
      and conrelid = 'public.estimate_segments'::regclass
  ) then
    alter table public.estimate_segments
      add constraint estimate_segments_shape_type_check
      check (shape_type in ('RECTANGLE', 'TRIANGLE', 'MANUAL'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'estimate_segments_include_check'
      and conrelid = 'public.estimate_segments'::regclass
  ) then
    alter table public.estimate_segments
      add constraint estimate_segments_include_check
      check (include in ('Y', 'N'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'estimate_segments_quantity_check'
      and conrelid = 'public.estimate_segments'::regclass
  ) then
    alter table public.estimate_segments
      add constraint estimate_segments_quantity_check
      check (quantity is null or quantity > 0);
  end if;
end $$;

create index if not exists estimate_segments_wall_scope_id_idx
  on public.estimate_segments (org_id, estimate_id, wall_scope_id, position);

drop index if exists public.estimate_segments_active_room_seg_key;

create unique index if not exists estimate_segments_active_scope_seg_key
  on public.estimate_segments (
    org_id,
    estimate_id,
    (coalesce(wall_scope_id::text, 'ROOM:' || coalesce(room_id, ''))),
    seg_no
  )
  where active = 'Y'
    and seg_no is not null
    and (
      wall_scope_id is not null
      or (room_id is not null and btrim(room_id) <> '')
    );

create table if not exists public.estimate_material_requirements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  position int not null default 0,
  room_id text null,
  wall_scope_id uuid null references public.estimate_room_wall_scopes(id) on delete cascade,
  segment_id uuid null references public.estimate_segments(id) on delete cascade,
  source_type text not null check (source_type in ('WALL_SCOPE', 'WALL_SEGMENT', 'MANUAL')),
  material_type text not null check (material_type in ('PAINT', 'PRIMER')),
  product_id text null,
  color_id text null,
  group_key text null,
  unit text not null default 'GAL',
  raw_quantity numeric not null default 0 check (raw_quantity >= 0),
  override_quantity numeric null check (override_quantity is null or override_quantity >= 0),
  effective_quantity numeric not null default 0 check (effective_quantity >= 0),
  allocated_cost numeric null,
  notes text null,
  active text not null default 'Y' check (active in ('Y', 'N')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists estimate_material_requirements_org_id_idx
  on public.estimate_material_requirements (org_id);

create index if not exists estimate_material_requirements_estimate_id_idx
  on public.estimate_material_requirements (org_id, estimate_id, position);

create index if not exists estimate_material_requirements_group_key_idx
  on public.estimate_material_requirements (org_id, estimate_id, material_type, product_id, color_id);

create table if not exists public.estimate_material_purchase_groups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  position int not null default 0,
  group_key text null,
  material_type text not null check (material_type in ('PAINT', 'PRIMER')),
  product_id text null,
  color_id text null,
  purchase_unit text not null default 'GAL',
  raw_quantity numeric not null default 0 check (raw_quantity >= 0),
  override_purchase_quantity numeric null check (
    override_purchase_quantity is null or override_purchase_quantity >= 0
  ),
  effective_purchase_quantity numeric not null default 0 check (effective_purchase_quantity >= 0),
  unit_cost numeric null,
  effective_total_cost numeric null,
  allocation_method text not null default 'RAW_QUANTITY' check (
    allocation_method in ('RAW_QUANTITY', 'AREA', 'MANUAL')
  ),
  notes text null,
  active text not null default 'Y' check (active in ('Y', 'N')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists estimate_material_purchase_groups_org_id_idx
  on public.estimate_material_purchase_groups (org_id);

create index if not exists estimate_material_purchase_groups_estimate_id_idx
  on public.estimate_material_purchase_groups (org_id, estimate_id, position);

create unique index if not exists estimate_material_purchase_groups_active_key
  on public.estimate_material_purchase_groups (
    org_id,
    estimate_id,
    material_type,
    coalesce(product_id, ''),
    coalesce(color_id, '')
  )
  where active = 'Y';

create table if not exists public.estimate_supply_requirements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  position int not null default 0,
  room_id text null,
  wall_scope_id uuid null references public.estimate_room_wall_scopes(id) on delete cascade,
  material_purchase_group_id uuid null references public.estimate_material_purchase_groups(id) on delete cascade,
  source_type text not null check (source_type in ('WALL_SCOPE', 'WALL_SEGMENT', 'ESTIMATE_VERSION')),
  supply_kind text not null check (supply_kind in ('PER_COLOR', 'AREA_BASED', 'MANUAL')),
  allocation_method text not null default 'DIRECT' check (
    allocation_method in ('DIRECT', 'RAW_GALLONS', 'AREA', 'MANUAL')
  ),
  description text not null,
  quantity numeric null,
  unit text null,
  raw_cost numeric not null default 0 check (raw_cost >= 0),
  override_cost numeric null check (override_cost is null or override_cost >= 0),
  effective_cost numeric not null default 0 check (effective_cost >= 0),
  notes text null,
  active text not null default 'Y' check (active in ('Y', 'N')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists estimate_supply_requirements_org_id_idx
  on public.estimate_supply_requirements (org_id);

create index if not exists estimate_supply_requirements_estimate_id_idx
  on public.estimate_supply_requirements (org_id, estimate_id, position);

create table if not exists public.estimate_pricing_policies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  labor_day_policy_enabled boolean not null default true,
  labor_day_minimum numeric not null default 1 check (labor_day_minimum > 0),
  labor_day_rounding_increment numeric not null default 0.5 check (labor_day_rounding_increment > 0),
  job_minimum_enabled boolean not null default false,
  job_minimum_amount numeric not null default 0 check (job_minimum_amount >= 0),
  manual_total_override numeric null check (manual_total_override is null or manual_total_override >= 0),
  hidden_adjustment_amount numeric null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, estimate_id)
);

create index if not exists estimate_pricing_policies_org_id_idx
  on public.estimate_pricing_policies (org_id);

create index if not exists estimate_pricing_policies_job_id_idx
  on public.estimate_pricing_policies (org_id, job_id);

create table if not exists public.estimate_room_rollups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  room_id text not null,
  position int not null default 0,
  raw_labor_hours numeric null,
  raw_labor_cost numeric null,
  raw_material_cost numeric null,
  raw_supply_cost numeric null,
  base_total numeric null,
  allocated_shared_charges numeric null,
  allocated_minimum_adjustment numeric null,
  final_total numeric null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, estimate_id, room_id)
);

create index if not exists estimate_room_rollups_org_id_idx
  on public.estimate_room_rollups (org_id);

create index if not exists estimate_room_rollups_estimate_id_idx
  on public.estimate_room_rollups (org_id, estimate_id, position);

create table if not exists public.estimate_version_rollups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  raw_labor_hours numeric null,
  raw_labor_days numeric null,
  effective_labor_days numeric null,
  labor_cost numeric null,
  paint_material_cost numeric null,
  primer_material_cost numeric null,
  supply_cost numeric null,
  shared_access_cost numeric null,
  prep_trip_cost numeric null,
  pre_policy_total numeric null,
  post_labor_policy_total numeric null,
  minimum_adjustment_amount numeric null,
  final_total numeric null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, estimate_id)
);

create index if not exists estimate_version_rollups_org_id_idx
  on public.estimate_version_rollups (org_id);

create index if not exists estimate_version_rollups_job_id_idx
  on public.estimate_version_rollups (org_id, job_id);

do $$
declare
  t text;
  trigger_name text;
begin
  foreach t in array array[
    'estimate_room_wall_scopes',
    'estimate_material_requirements',
    'estimate_material_purchase_groups',
    'estimate_supply_requirements',
    'estimate_pricing_policies',
    'estimate_room_rollups',
    'estimate_version_rollups'
  ] loop
    execute format('alter table public.%I enable row level security', t);

    trigger_name := 'trg_' || t || '_set_updated_at';
    execute format('drop trigger if exists %I on public.%I', trigger_name, t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      trigger_name,
      t
    );

    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (
        exists (
          select 1
          from public.org_members m
          where m.user_id = auth.uid()
            and m.org_id = %I.org_id
        )
      )',
      t || '_select',
      t,
      t
    );

    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (
        exists (
          select 1
          from public.org_members m
          where m.user_id = auth.uid()
            and m.org_id = %I.org_id
        )
      )',
      t || '_insert',
      t,
      t
    );

    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (
        exists (
          select 1
          from public.org_members m
          where m.user_id = auth.uid()
            and m.org_id = %I.org_id
        )
      )',
      t || '_update',
      t,
      t
    );

    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (
        exists (
          select 1
          from public.org_members m
          where m.user_id = auth.uid()
            and m.org_id = %I.org_id
        )
      )',
      t || '_delete',
      t,
      t
    );
  end loop;
end $$;
