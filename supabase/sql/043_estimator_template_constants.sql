-- Estimator v2 template constants stored in DB (app-only source of truth for Rates & Flags)

create table if not exists public.estimator_template_constants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  version integer not null default 1 check (version > 0),
  seeded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id)
);

create table if not exists public.estimator_template_constant_rows (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  template_id uuid not null references public.estimator_template_constants(id) on delete cascade,
  category_key text not null check (
    category_key in (
      'production_rates_walls',
      'production_rates_ceilings',
      'unit_rates_doors',
      'unit_rates_trim',
      'unit_rates_drywall',
      'access_fees_ladders',
      'access_fees_scaffolding',
      'access_fees_specialty',
      'supply_rates_per_color',
      'supply_rates_area_based',
      'supply_rates_per_job',
      'supply_rates_roller_covers',
      'room_types',
      'room_templates',
      'scope_defaults',
      -- generic category keys reserved for server compatibility
      'unit_rates',
      'access_fees',
      'supply_rates',
      'production_rates',
      'area_costs',
      'fixed_fees',
      'wall_complexity',
      'height_factors',
      'ceiling_types',
      'condition_modifiers'
    )
  ),
  row_id text not null check (row_id ~ '^[A-Z0-9_]+$'),
  display_name text not null,
  active text not null default 'Y' check (active in ('Y', 'N')),
  sort_order int not null default 0,
  values_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, category_key, row_id)
);

create table if not exists public.estimate_catalog_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  template_version integer null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (org_id, estimate_id)
);

create index if not exists estimator_template_constant_rows_org_template_cat_sort_idx
  on public.estimator_template_constant_rows (org_id, template_id, category_key, sort_order, created_at);

create index if not exists estimate_catalog_snapshots_org_estimate_idx
  on public.estimate_catalog_snapshots (org_id, estimate_id);

-- Backward compatibility migration for pre-rearrangement seeded rows.
update public.estimator_template_constant_rows
set category_key = 'access_fees_specialty'
where category_key = 'fixed_fees';

update public.estimator_template_constant_rows
set
  category_key = 'supply_rates_area_based',
  values_json = jsonb_set(
    jsonb_set(coalesce(values_json, '{}'::jsonb), '{supply_group}', '\"area_based\"'::jsonb, true),
    '{unit}',
    to_jsonb(coalesce(nullif(values_json->>'unit', ''), '$/sqft')),
    true
  )
where category_key = 'area_costs';

update public.estimator_template_constant_rows
set
  category_key = 'production_rates_walls',
  values_json = jsonb_set(
    coalesce(values_json, '{}'::jsonb),
    '{production_scope}',
    '\"walls\"'::jsonb,
    true
  )
where category_key = 'production_rates';

alter table public.estimator_template_constants enable row level security;
alter table public.estimator_template_constant_rows enable row level security;
alter table public.estimate_catalog_snapshots enable row level security;

drop trigger if exists trg_estimator_template_constants_set_updated_at on public.estimator_template_constants;
create trigger trg_estimator_template_constants_set_updated_at
before update on public.estimator_template_constants
for each row
execute function public.set_updated_at();

drop trigger if exists trg_estimator_template_constant_rows_set_updated_at on public.estimator_template_constant_rows;
create trigger trg_estimator_template_constant_rows_set_updated_at
before update on public.estimator_template_constant_rows
for each row
execute function public.set_updated_at();

drop policy if exists "estimator_template_constants_select" on public.estimator_template_constants;
create policy "estimator_template_constants_select"
  on public.estimator_template_constants
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimator_template_constants.org_id
    )
  );

drop policy if exists "estimator_template_constants_insert" on public.estimator_template_constants;
create policy "estimator_template_constants_insert"
  on public.estimator_template_constants
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimator_template_constants.org_id
    )
  );

drop policy if exists "estimator_template_constants_update" on public.estimator_template_constants;
create policy "estimator_template_constants_update"
  on public.estimator_template_constants
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimator_template_constants.org_id
    )
  );

drop policy if exists "estimator_template_constants_delete" on public.estimator_template_constants;
create policy "estimator_template_constants_delete"
  on public.estimator_template_constants
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimator_template_constants.org_id
    )
  );

drop policy if exists "estimator_template_constant_rows_select" on public.estimator_template_constant_rows;
create policy "estimator_template_constant_rows_select"
  on public.estimator_template_constant_rows
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimator_template_constant_rows.org_id
    )
  );

drop policy if exists "estimator_template_constant_rows_insert" on public.estimator_template_constant_rows;
create policy "estimator_template_constant_rows_insert"
  on public.estimator_template_constant_rows
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimator_template_constant_rows.org_id
    )
  );

drop policy if exists "estimator_template_constant_rows_update" on public.estimator_template_constant_rows;
create policy "estimator_template_constant_rows_update"
  on public.estimator_template_constant_rows
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimator_template_constant_rows.org_id
    )
  );

drop policy if exists "estimator_template_constant_rows_delete" on public.estimator_template_constant_rows;
create policy "estimator_template_constant_rows_delete"
  on public.estimator_template_constant_rows
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimator_template_constant_rows.org_id
    )
  );

drop policy if exists "estimate_catalog_snapshots_select" on public.estimate_catalog_snapshots;
create policy "estimate_catalog_snapshots_select"
  on public.estimate_catalog_snapshots
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_catalog_snapshots.org_id
    )
  );

drop policy if exists "estimate_catalog_snapshots_insert" on public.estimate_catalog_snapshots;
create policy "estimate_catalog_snapshots_insert"
  on public.estimate_catalog_snapshots
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_catalog_snapshots.org_id
    )
  );

drop policy if exists "estimate_catalog_snapshots_update" on public.estimate_catalog_snapshots;
create policy "estimate_catalog_snapshots_update"
  on public.estimate_catalog_snapshots
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_catalog_snapshots.org_id
    )
  );

drop policy if exists "estimate_catalog_snapshots_delete" on public.estimate_catalog_snapshots;
create policy "estimate_catalog_snapshots_delete"
  on public.estimate_catalog_snapshots
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_catalog_snapshots.org_id
    )
  );
