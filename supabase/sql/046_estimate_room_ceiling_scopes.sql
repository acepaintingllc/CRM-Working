-- v2 ceiling scopes: one per room in RECT mode, multiple per room in SEG mode.
-- Mirrors estimate_room_wall_scopes; ceiling_type_id maps to labor_mult in the
-- ceiling_types catalog. No door/window deduction columns (ceilings have none).

create table if not exists public.estimate_room_ceiling_scopes (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.orgs(id) on delete cascade,
  estimate_id     uuid not null references public.estimates(id) on delete cascade,
  job_id          uuid not null references public.jobs(id) on delete cascade,
  room_id         text not null,
  position        int  not null default 0,
  mode            text not null default 'RECT' check (mode in ('RECT', 'SEG')),
  include         text not null default 'Y'    check (include in ('Y', 'N')),
  scope_name      text null,
  -- product / color
  color_id              text null,
  paint_product_id      text null,
  primer_product_id     text null,
  prime_mode            text not null default 'NONE' check (prime_mode in ('NONE', 'SPOT', 'FULL')),
  spot_prime_percent    numeric null,
  ceiling_type_id       text null,   -- references catalog ceiling_types.id
  ceiling_geometry_mode text null check (ceiling_geometry_mode in ('FLAT', 'VAULTED', 'TRAY', 'COFFERED', 'MANUAL')),
  vaulted_area_factor   numeric null,
  tray_perimeter_in     numeric null,
  tray_step_height_in   numeric null,
  tray_band_width_in    numeric null,
  coffer_section_length_in numeric null,
  coffer_section_width_in  numeric null,
  coffer_section_count     numeric null,
  coffer_face_height_in    numeric null,
  coffer_bottom_width_in   numeric null,
  helper_extra_area_sf     numeric null,
  -- RECT geometry (area_sf is an alternative to L×W)
  length_in       numeric null,
  width_in        numeric null,
  area_sf         numeric null,
  -- labor modifiers
  height_factor        numeric null,
  complexity_factor    numeric null,
  ceiling_flag_factor  numeric null,  -- product of room flags ceil_factor values
  -- overrides
  override_area_sf          numeric null,
  override_paint_hours      numeric null,
  override_primer_hours     numeric null,
  override_paint_gallons    numeric null,
  override_primer_gallons   numeric null,
  override_supply_cost      numeric null,
  override_total            numeric null,
  -- computed outputs (written back by the ceiling engine)
  raw_area_sf               numeric null,
  effective_area_sf         numeric null,
  raw_paint_hours           numeric null,
  effective_paint_hours     numeric null,
  raw_primer_hours          numeric null,
  effective_primer_hours    numeric null,
  raw_paint_gallons         numeric null,
  effective_paint_gallons   numeric null,
  raw_primer_gallons        numeric null,
  effective_primer_gallons  numeric null,
  raw_supply_cost           numeric null,
  effective_supply_cost     numeric null,
  raw_total                 numeric null,
  effective_total           numeric null,
  -- per-scope setting overrides (override global defaults from jobsettings)
  paint_coats                         numeric null,
  primer_coats                        numeric null,
  paint_prod_rate_sqft_per_hour       numeric null,
  primer_prod_rate_sqft_per_hour      numeric null,
  paint_coverage_sqft_per_gal_per_coat  numeric null,
  primer_coverage_sqft_per_gal_per_coat numeric null,
  area_supply_cost_per_sf             numeric null,
  per_color_supply_cost               numeric null,
  labor_rate_per_hour                 numeric null,
  paint_price_per_gal                 numeric null,
  primer_price_per_gal                numeric null,
  notes       text null,
  active      text not null default 'Y' check (active in ('Y', 'N')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists estimate_room_ceiling_scopes_org_idx
  on public.estimate_room_ceiling_scopes (org_id);
create index if not exists estimate_room_ceiling_scopes_estimate_idx
  on public.estimate_room_ceiling_scopes (org_id, estimate_id, position);
create index if not exists estimate_room_ceiling_scopes_room_idx
  on public.estimate_room_ceiling_scopes (org_id, estimate_id, room_id);

alter table public.estimate_room_ceiling_scopes enable row level security;

drop trigger if exists trg_estimate_room_ceiling_scopes_set_updated_at
  on public.estimate_room_ceiling_scopes;
create trigger trg_estimate_room_ceiling_scopes_set_updated_at
  before update on public.estimate_room_ceiling_scopes
  for each row execute function public.set_updated_at();

drop policy if exists "estimate_room_ceiling_scopes_select" on public.estimate_room_ceiling_scopes;
create policy "estimate_room_ceiling_scopes_select"
  on public.estimate_room_ceiling_scopes for select to authenticated
  using (
    exists (
      select 1 from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_room_ceiling_scopes.org_id
    )
  );

drop policy if exists "estimate_room_ceiling_scopes_insert" on public.estimate_room_ceiling_scopes;
create policy "estimate_room_ceiling_scopes_insert"
  on public.estimate_room_ceiling_scopes for insert to authenticated
  with check (
    exists (
      select 1 from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_room_ceiling_scopes.org_id
    )
  );

drop policy if exists "estimate_room_ceiling_scopes_update" on public.estimate_room_ceiling_scopes;
create policy "estimate_room_ceiling_scopes_update"
  on public.estimate_room_ceiling_scopes for update to authenticated
  using (
    exists (
      select 1 from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_room_ceiling_scopes.org_id
    )
  );

drop policy if exists "estimate_room_ceiling_scopes_delete" on public.estimate_room_ceiling_scopes;
create policy "estimate_room_ceiling_scopes_delete"
  on public.estimate_room_ceiling_scopes for delete to authenticated
  using (
    exists (
      select 1 from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_room_ceiling_scopes.org_id
    )
  );
