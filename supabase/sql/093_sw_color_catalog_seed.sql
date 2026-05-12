-- Sherwin-Williams color catalog foundation.
-- This migration adds search/import fields to the phase 2 paint catalog tables
-- and seeds a starter Sherwin-Williams catalog plus a manual/custom fallback.
-- Larger official catalogs should be imported with scripts/import-sw-colors.mjs
-- from an authorized CSV/JSON export.

alter table public.paint_color_catalog
  add column if not exists external_code text null,
  add column if not exists name text null,
  add column if not exists family text null,
  add column if not exists hex text null,
  add column if not exists lrv numeric null,
  add column if not exists collection text null,
  add column if not exists active boolean not null default true,
  add column if not exists metadata_json jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'paint_color_catalog_lrv_range_check'
      and conrelid = 'public.paint_color_catalog'::regclass
  ) then
    alter table public.paint_color_catalog
      add constraint paint_color_catalog_lrv_range_check
      check (lrv is null or (lrv >= 0 and lrv <= 100)) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'paint_color_catalog_hex_check'
      and conrelid = 'public.paint_color_catalog'::regclass
  ) then
    alter table public.paint_color_catalog
      add constraint paint_color_catalog_hex_check
      check (hex is null or hex ~* '^#[0-9a-f]{6}$') not valid;
  end if;
end;
$$;

update public.paint_color_catalog
set
  external_code = coalesce(external_code, color_number),
  name = coalesce(name, color_name),
  hex = coalesce(hex, hex_color),
  collection = coalesce(collection, collection_name),
  active = case when status = 'archived' then false else active end,
  metadata_json = coalesce(metadata_json, '{}'::jsonb);

create unique index if not exists paint_color_catalog_org_brand_external_code_uniq
  on public.paint_color_catalog (org_id, brand_id, external_code);

create index if not exists paint_color_catalog_org_search_idx
  on public.paint_color_catalog (org_id, active, family, name, external_code);

create index if not exists paint_color_catalog_org_manual_idx
  on public.paint_color_catalog (org_id)
  where metadata_json ->> 'manual_fallback' = 'true';

with sw_brand as (
  insert into public.paint_brands (
    org_id,
    name,
    display_name,
    external_ref,
    status
  )
  select
    orgs.id,
    'sherwin-williams',
    'Sherwin-Williams',
    'SW',
    'active'
  from public.orgs
  on conflict (org_id, name) do update
    set
      display_name = excluded.display_name,
      external_ref = excluded.external_ref,
      status = 'active'
  returning id, org_id
),
manual_brand as (
  insert into public.paint_brands (
    org_id,
    name,
    display_name,
    external_ref,
    status
  )
  select
    orgs.id,
    'manual-custom',
    'Manual / Custom',
    'manual',
    'active'
  from public.orgs
  on conflict (org_id, name) do update
    set
      display_name = excluded.display_name,
      external_ref = excluded.external_ref,
      status = 'active'
  returning id, org_id
),
sw_seed(external_code, name, family, hex, lrv, collection, sort_order) as (
  values
    ('SW 7005', 'Pure White', 'white', null, null, 'Starter SW colors', 10),
    ('SW 7008', 'Alabaster', 'white', null, null, 'Starter SW colors', 20),
    ('SW 7014', 'Eider White', 'white', null, null, 'Starter SW colors', 30),
    ('SW 7015', 'Repose Gray', 'gray', null, null, 'Starter SW colors', 40),
    ('SW 7016', 'Mindful Gray', 'gray', null, null, 'Starter SW colors', 50),
    ('SW 7017', 'Dorian Gray', 'gray', null, null, 'Starter SW colors', 60),
    ('SW 7029', 'Agreeable Gray', 'gray', null, null, 'Starter SW colors', 70),
    ('SW 7036', 'Accessible Beige', 'beige', null, null, 'Starter SW colors', 80),
    ('SW 7043', 'Worldly Gray', 'gray', null, null, 'Starter SW colors', 90),
    ('SW 7069', 'Iron Ore', 'black', null, null, 'Starter SW colors', 100),
    ('SW 7071', 'Gray Screen', 'gray', null, null, 'Starter SW colors', 110),
    ('SW 7076', 'Cyberspace', 'blue', null, null, 'Starter SW colors', 120),
    ('SW 6258', 'Tricorn Black', 'black', null, null, 'Starter SW colors', 130),
    ('SW 6204', 'Sea Salt', 'green', null, null, 'Starter SW colors', 140),
    ('SW 6211', 'Rainwashed', 'green', null, null, 'Starter SW colors', 150),
    ('SW 6244', 'Naval', 'blue', null, null, 'Starter SW colors', 160),
    ('SW 6236', 'Grays Harbor', 'blue', null, null, 'Starter SW colors', 170),
    ('SW 6385', 'Dover White', 'white', null, null, 'Starter SW colors', 180),
    ('SW 6106', 'Kilim Beige', 'beige', null, null, 'Starter SW colors', 190),
    ('SW 0055', 'Light French Gray', 'gray', null, null, 'Starter SW colors', 200)
)
insert into public.paint_color_catalog (
  org_id,
  brand_id,
  brand_display_name,
  color_number,
  external_code,
  color_name,
  name,
  display_name,
  family,
  hex_color,
  hex,
  lrv,
  collection_name,
  collection,
  status,
  active,
  metadata_json
)
select
  sw_brand.org_id,
  sw_brand.id,
  'Sherwin-Williams',
  sw_seed.external_code,
  sw_seed.external_code,
  sw_seed.name,
  sw_seed.name,
  sw_seed.external_code || ' ' || sw_seed.name,
  sw_seed.family,
  sw_seed.hex,
  sw_seed.hex,
  sw_seed.lrv,
  sw_seed.collection,
  sw_seed.collection,
  'active',
  true,
  jsonb_build_object(
    'source', 'starter_seed',
    'source_note', 'Starter searchable subset. Import an authorized catalog export for full SW coverage.',
    'sort_order', sw_seed.sort_order
  )
from sw_brand
cross join sw_seed
on conflict (org_id, brand_id, external_code)
do update set
  brand_display_name = excluded.brand_display_name,
  color_number = excluded.color_number,
  color_name = excluded.color_name,
  name = excluded.name,
  display_name = excluded.display_name,
  family = excluded.family,
  hex_color = excluded.hex_color,
  hex = excluded.hex,
  lrv = excluded.lrv,
  collection_name = excluded.collection_name,
  collection = excluded.collection,
  status = excluded.status,
  active = excluded.active,
  metadata_json = public.paint_color_catalog.metadata_json || excluded.metadata_json;

insert into public.paint_color_catalog (
  org_id,
  brand_id,
  brand_display_name,
  color_number,
  external_code,
  color_name,
  name,
  display_name,
  family,
  collection_name,
  collection,
  status,
  active,
  metadata_json
)
select
  manual_brand.org_id,
  manual_brand.id,
  'Manual / Custom',
  'CUSTOM',
  'CUSTOM',
  'Custom color',
  'Custom color',
  'Custom color',
  'custom',
  'Manual entry',
  'Manual entry',
  'active',
  true,
  jsonb_build_object(
    'manual_fallback', true,
    'source', 'system_seed',
    'source_note', 'Use when the customer specifies a color outside the searchable catalog.'
  )
from manual_brand
on conflict (org_id, brand_id, external_code)
do update set
  brand_display_name = excluded.brand_display_name,
  color_name = excluded.color_name,
  name = excluded.name,
  display_name = excluded.display_name,
  family = excluded.family,
  collection_name = excluded.collection_name,
  collection = excluded.collection,
  status = 'active',
  active = true,
  metadata_json = public.paint_color_catalog.metadata_json || excluded.metadata_json;

alter table public.paint_color_catalog
  validate constraint paint_color_catalog_lrv_range_check;

alter table public.paint_color_catalog
  validate constraint paint_color_catalog_hex_check;
