-- Estimator V2 painted door scopes.

create table if not exists public.estimate_room_door_scopes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  room_id text not null,
  position int not null default 0,
  include text not null default 'Y' check (include in ('Y', 'N')),
  scope_name text null,
  door_type_id text null,
  color_id text null,
  paint_product_id text null,
  primer_product_id text null,
  prime_mode text not null default 'NONE' check (prime_mode in ('NONE', 'SPOT', 'FULL')),
  quantity numeric null check (quantity is null or quantity >= 0),
  sides numeric null check (sides is null or sides >= 0),
  paint_coats numeric null check (paint_coats is null or paint_coats >= 0),
  primer_coats numeric null check (primer_coats is null or primer_coats >= 0),
  spot_prime_percent numeric null check (spot_prime_percent is null or spot_prime_percent between 0 and 100),
  condition_factor numeric null check (condition_factor is null or condition_factor >= 0),
  labor_rate numeric null check (labor_rate is null or labor_rate >= 0),
  material_rate numeric null check (material_rate is null or material_rate >= 0),
  raw_units numeric null,
  effective_units numeric null,
  raw_paint_hours numeric null,
  override_paint_hours numeric null,
  effective_paint_hours numeric null,
  raw_primer_hours numeric null,
  override_primer_hours numeric null,
  effective_primer_hours numeric null,
  raw_material_cost numeric null,
  override_material_cost numeric null,
  effective_material_cost numeric null,
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

create index if not exists estimate_room_door_scopes_org_id_idx
  on public.estimate_room_door_scopes (org_id);

create index if not exists estimate_room_door_scopes_estimate_id_idx
  on public.estimate_room_door_scopes (org_id, estimate_id, room_id, position);

create index if not exists estimate_room_door_scopes_job_id_idx
  on public.estimate_room_door_scopes (org_id, job_id);

alter table public.estimate_room_door_scopes enable row level security;

drop trigger if exists trg_estimate_room_door_scopes_set_updated_at on public.estimate_room_door_scopes;
create trigger trg_estimate_room_door_scopes_set_updated_at
before update on public.estimate_room_door_scopes
for each row
execute function public.set_updated_at();

drop policy if exists estimate_room_door_scopes_select on public.estimate_room_door_scopes;
create policy estimate_room_door_scopes_select
  on public.estimate_room_door_scopes
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_room_door_scopes.org_id
    )
  );

drop policy if exists estimate_room_door_scopes_insert on public.estimate_room_door_scopes;
create policy estimate_room_door_scopes_insert
  on public.estimate_room_door_scopes
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_room_door_scopes.org_id
    )
  );

drop policy if exists estimate_room_door_scopes_update on public.estimate_room_door_scopes;
create policy estimate_room_door_scopes_update
  on public.estimate_room_door_scopes
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_room_door_scopes.org_id
    )
  );

drop policy if exists estimate_room_door_scopes_delete on public.estimate_room_door_scopes;
create policy estimate_room_door_scopes_delete
  on public.estimate_room_door_scopes
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_room_door_scopes.org_id
    )
  );
