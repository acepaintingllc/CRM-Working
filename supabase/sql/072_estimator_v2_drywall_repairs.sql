-- Estimator V2 drywall repair scopes and default drywall repair rates.

create table if not exists public.estimate_drywall_repairs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  room_id text not null,
  position int not null default 0,
  surface text not null check (surface in ('wall', 'ceiling')),
  repair_type text not null check (
    repair_type in (
      'corner_tape_replacement',
      'flat_wall_crack',
      'stress_crack_at_seam',
      'ceiling_crack',
      'patch_opening_repair'
    )
  ),
  unit text not null check (unit in ('LF', 'SQFT')),
  quantity numeric not null check (quantity >= 0),
  raw_quantity numeric null,
  effective_quantity numeric null,
  base_unit_rate numeric null,
  ceiling_multiplier numeric null,
  calculated_total numeric null,
  override_total numeric null,
  raw_total numeric null,
  effective_total numeric null,
  active text not null default 'Y' check (active in ('Y', 'N')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint estimate_drywall_repairs_surface_type_check check (
    (surface = 'wall' and repair_type in ('corner_tape_replacement', 'flat_wall_crack', 'stress_crack_at_seam', 'patch_opening_repair'))
    or
    (surface = 'ceiling' and repair_type in ('ceiling_crack', 'patch_opening_repair'))
  ),
  constraint estimate_drywall_repairs_unit_type_check check (
    (repair_type in ('corner_tape_replacement', 'flat_wall_crack', 'stress_crack_at_seam', 'ceiling_crack') and unit = 'LF')
    or
    (repair_type = 'patch_opening_repair' and unit = 'SQFT')
  )
);

create index if not exists estimate_drywall_repairs_org_id_idx
  on public.estimate_drywall_repairs (org_id);

create index if not exists estimate_drywall_repairs_estimate_room_idx
  on public.estimate_drywall_repairs (org_id, estimate_id, room_id, position);

create index if not exists estimate_drywall_repairs_job_id_idx
  on public.estimate_drywall_repairs (org_id, job_id);

alter table public.estimate_drywall_repairs enable row level security;

drop trigger if exists trg_estimate_drywall_repairs_set_updated_at on public.estimate_drywall_repairs;
create trigger trg_estimate_drywall_repairs_set_updated_at
before update on public.estimate_drywall_repairs
for each row
execute function public.set_updated_at();

drop policy if exists estimate_drywall_repairs_select on public.estimate_drywall_repairs;
create policy estimate_drywall_repairs_select
  on public.estimate_drywall_repairs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_drywall_repairs.org_id
    )
  );

drop policy if exists estimate_drywall_repairs_insert on public.estimate_drywall_repairs;
create policy estimate_drywall_repairs_insert
  on public.estimate_drywall_repairs
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_drywall_repairs.org_id
    )
  );

drop policy if exists estimate_drywall_repairs_update on public.estimate_drywall_repairs;
create policy estimate_drywall_repairs_update
  on public.estimate_drywall_repairs
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_drywall_repairs.org_id
    )
  );

drop policy if exists estimate_drywall_repairs_delete on public.estimate_drywall_repairs;
create policy estimate_drywall_repairs_delete
  on public.estimate_drywall_repairs
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_drywall_repairs.org_id
    )
  );

with seed_rows(row_id, display_name, sort_order, repair_type, unit, amount, ceiling_multiplier) as (
  values
    ('CORNER_TAPE_REPLACEMENT', 'Corner tape replacement', 10, 'corner_tape_replacement', 'LF', 18, 1.35),
    ('FLAT_WALL_CRACK', 'Flat wall crack', 20, 'flat_wall_crack', 'LF', 12, 1.35),
    ('STRESS_CRACK_AT_SEAM', 'Stress crack at seam', 30, 'stress_crack_at_seam', 'LF', 14, 1.35),
    ('CEILING_CRACK', 'Ceiling crack', 40, 'ceiling_crack', 'LF', 16, 1.35),
    ('PATCH_OPENING_REPAIR', 'Patch/opening repair', 50, 'patch_opening_repair', 'SQFT', 45, 1.25)
)
insert into public.estimator_template_constant_rows (
  org_id,
  template_id,
  category_key,
  row_id,
  display_name,
  active,
  sort_order,
  values_json
)
select
  t.org_id,
  t.id,
  'unit_rates_drywall',
  s.row_id,
  s.display_name,
  'Y',
  s.sort_order,
  jsonb_build_object(
    'unit_rate_group', 'drywall',
    'id', lower(s.repair_type),
    'display_name', s.display_name,
    'unit_rate_type', s.repair_type,
    'unit', s.unit,
    'default_qty', 1,
    'labor_rate', 0,
    'material_rate', 0,
    'amount', s.amount,
    'ceiling_multiplier', s.ceiling_multiplier,
    'notes', 'Seeded Estimator V2 drywall repair rate'
  )
from public.estimator_template_constants t
cross join seed_rows s
on conflict (org_id, category_key, row_id) do update
set
  display_name = excluded.display_name,
  active = excluded.active,
  sort_order = excluded.sort_order,
  values_json = public.estimator_template_constant_rows.values_json || excluded.values_json,
  updated_at = now();
