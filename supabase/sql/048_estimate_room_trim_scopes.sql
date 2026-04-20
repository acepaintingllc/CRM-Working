-- v2 trim scopes: dynamic trim rows/items per room.
-- One row per trim item (baseboard/crown/casing/etc), with helper/manual measurement
-- modes and full paint/primer/modifier/override fields.

create table if not exists public.estimate_room_trim_scopes (
  id                                    uuid primary key default gen_random_uuid(),
  org_id                                uuid not null references public.orgs(id) on delete cascade,
  estimate_id                           uuid not null references public.estimates(id) on delete cascade,
  job_id                                uuid not null references public.jobs(id) on delete cascade,
  room_id                               text not null,
  position                              int  not null default 0,
  include                               text not null default 'Y' check (include in ('Y', 'N')),
  scope_name                            text null,
  trim_type_id                          text null,
  trim_family                           text null,
  unit_type                             text not null default 'LF' check (unit_type in ('LF', 'EA', 'SF')),
  measurement_mode                      text not null default 'MANUAL' check (measurement_mode in ('MANUAL', 'ROOM_HELPER')),
  helper_source                         text null check (helper_source in ('ROOM_PERIMETER') or helper_source is null),
  measurement_value                     numeric null,
  helper_value                          numeric null,
  color_id                              text null,
  paint_product_id                      text null,
  primer_product_id                     text null,
  paint_enabled                         text not null default 'Y' check (paint_enabled in ('Y', 'N')),
  prime_mode                            text not null default 'NONE' check (prime_mode in ('NONE', 'SPOT', 'FULL')),
  spot_prime_percent                    numeric null,
  production_rate_id                    text null,
  prep_factor                           numeric null,
  height_factor                         numeric null,
  profile_factor                        numeric null,
  room_flag_factor                      numeric null,
  masking_factor                        numeric null,
  stair_factor                          numeric null,
  difficult_finish_factor               numeric null,
  caulk_fill_factor                     numeric null,
  override_measurement                  numeric null,
  override_hours                        numeric null,
  override_gallons                      numeric null,
  override_supply_cost                  numeric null,
  override_total                        numeric null,
  override_description                  text null,
  raw_measurement                       numeric null,
  effective_measurement                 numeric null,
  raw_paint_hours                       numeric null,
  effective_paint_hours                 numeric null,
  raw_primer_hours                      numeric null,
  effective_primer_hours                numeric null,
  raw_paint_gallons                     numeric null,
  effective_paint_gallons               numeric null,
  raw_primer_gallons                    numeric null,
  effective_primer_gallons              numeric null,
  raw_supply_cost                       numeric null,
  effective_supply_cost                 numeric null,
  raw_total                             numeric null,
  effective_total                       numeric null,
  paint_coats                           numeric null,
  primer_coats                          numeric null,
  paint_prod_rate_units_per_hour        numeric null,
  primer_prod_rate_units_per_hour       numeric null,
  paint_coverage_units_per_gal_per_coat numeric null,
  primer_coverage_units_per_gal_per_coat numeric null,
  area_supply_cost_per_unit             numeric null,
  per_color_supply_cost                 numeric null,
  labor_rate_per_hour                   numeric null,
  paint_price_per_gal                   numeric null,
  primer_price_per_gal                  numeric null,
  notes                                 text null,
  active                                text not null default 'Y' check (active in ('Y', 'N')),
  created_at                            timestamptz not null default now(),
  updated_at                            timestamptz not null default now()
);

create index if not exists estimate_room_trim_scopes_org_idx
  on public.estimate_room_trim_scopes (org_id);
create index if not exists estimate_room_trim_scopes_estimate_idx
  on public.estimate_room_trim_scopes (org_id, estimate_id, position);
create index if not exists estimate_room_trim_scopes_room_idx
  on public.estimate_room_trim_scopes (org_id, estimate_id, room_id);

alter table public.estimate_room_trim_scopes enable row level security;

drop trigger if exists trg_estimate_room_trim_scopes_set_updated_at
  on public.estimate_room_trim_scopes;
create trigger trg_estimate_room_trim_scopes_set_updated_at
  before update on public.estimate_room_trim_scopes
  for each row execute function public.set_updated_at();

drop policy if exists "estimate_room_trim_scopes_select" on public.estimate_room_trim_scopes;
create policy "estimate_room_trim_scopes_select"
  on public.estimate_room_trim_scopes for select to authenticated
  using (
    exists (
      select 1 from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_room_trim_scopes.org_id
    )
  );

drop policy if exists "estimate_room_trim_scopes_insert" on public.estimate_room_trim_scopes;
create policy "estimate_room_trim_scopes_insert"
  on public.estimate_room_trim_scopes for insert to authenticated
  with check (
    exists (
      select 1 from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_room_trim_scopes.org_id
    )
  );

drop policy if exists "estimate_room_trim_scopes_update" on public.estimate_room_trim_scopes;
create policy "estimate_room_trim_scopes_update"
  on public.estimate_room_trim_scopes for update to authenticated
  using (
    exists (
      select 1 from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_room_trim_scopes.org_id
    )
  );

drop policy if exists "estimate_room_trim_scopes_delete" on public.estimate_room_trim_scopes;
create policy "estimate_room_trim_scopes_delete"
  on public.estimate_room_trim_scopes for delete to authenticated
  using (
    exists (
      select 1 from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_room_trim_scopes.org_id
    )
  );
