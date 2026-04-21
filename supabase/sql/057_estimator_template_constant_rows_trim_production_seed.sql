-- Seed trim production rows directly into estimator_template_constant_rows.
-- This resolves the org automatically:
-- 1. current authenticated user's earliest org_members row
-- 2. fallback to the earliest org named 'ACE Painting'
-- If your org has a different name, change the fallback name below.

with target_org as (
  select coalesce(
    (
      select m.org_id
      from public.org_members m
      where m.user_id = auth.uid()
      order by m.created_at asc nulls last, m.org_id asc
      limit 1
    ),
    (
      select o.id
      from public.orgs o
      where o.name = 'ACE Painting'
      order by o.created_at asc nulls last, o.id asc
      limit 1
    )
  ) as org_id
),
ensure_template as (
  insert into public.estimator_template_constants (org_id, version, seeded_at)
  select org_id, 1, now()
  from target_org
  where org_id is not null
  on conflict (org_id) do update
    set updated_at = now()
  returning id, org_id
),
source_rows as (
  select *
  from (
    values
      (0,  'BASE_STD_LF',       'Baseboard - Standard',              'Baseboard',     'Standard',          0.50::numeric,  0.75::numeric,  0.65::numeric,  null::text, 'Y'),
      (1,  'BASE_LG_LF',        'Baseboard - Large',                 'Baseboard',     'Large',             0.65::numeric,  0.95::numeric,  0.85::numeric,  null::text, 'Y'),
      (2,  'BASE_STAIR_LF',     'Baseboard - Stair Skirt',           'Baseboard',     'Stair Skirt',       0.85::numeric,  0.95::numeric,  0.85::numeric,  null::text, 'Y'),
      (3,  'BASE_WAINSCOT_LF',  'Baseboard - Wainscoting',           'Baseboard',     'Wainscoting',       1.50::numeric,  1.90::numeric,  1.80::numeric,  null::text, 'Y'),
      (4,  'CROWN_STD_LF',      'Crown - Standard',                  'Crown',         'Standard',          0.40::numeric,  0.45::numeric,  0.40::numeric,  null::text, 'Y'),
      (5,  'CROWN_MED_LF',      'Crown - Medium',                    'Crown',         'Medium',            0.50::numeric,  0.55::numeric,  0.50::numeric,  null::text, 'Y'),
      (6,  'CROWN_LG_LF',       'Crown - Large',                     'Crown',         'Large',             0.65::numeric,  0.70::numeric,  0.62::numeric,  null::text, 'Y'),
      (7,  'WIN_STD_EA',        'Window Casing - Standard',          'Window Casing', 'Standard',         10.00::numeric,  9.00::numeric,  8.00::numeric,  null::text, 'Y'),
      (8,  'WIN_LG_EA',         'Window Casing - Large',             'Window Casing', 'Large',            12.00::numeric, 11.00::numeric, 10.00::numeric,  null::text, 'Y'),
      (9,  'WIN_DBL_EA',        'Window Casing - Double',            'Window Casing', 'Double',           15.00::numeric, 13.00::numeric, 12.00::numeric,  null::text, 'Y'),
      (10, 'WIN_DBL_TALL_EA',   'Window Casing - Double Tall',       'Window Casing', 'Double Tall',      18.00::numeric, 16.00::numeric, 14.00::numeric,  null::text, 'Y'),
      (11, 'WIN_ARCH_EA',       'Window Casing - Arch',              'Window Casing', 'Arch',             23.00::numeric, 20.00::numeric, 18.00::numeric,  null::text, 'Y'),
      (12, 'WIN_WOOD_GRID_EA',  'Window - Wood with Cross Grid',     'Window',        'Wood Cross Grid',  15.00::numeric, 20.00::numeric, 18.00::numeric,  null::text, 'Y'),
      (13, 'DCASING_STD_EA',    'Door Casing - Standard',            'Door Casing',   'Standard',         13.00::numeric, 10.00::numeric,  9.00::numeric,  null::text, 'Y'),
      (14, 'DCASING_LG_EA',     'Door Casing - Large',               'Door Casing',   'Large',            13.00::numeric, 12.00::numeric, 10.50::numeric,  null::text, 'Y'),
      (15, 'DCASING_DBL_EA',    'Door Casing - Double',              'Door Casing',   'Double',           14.00::numeric, 11.00::numeric,  9.00::numeric,  null::text, 'Y'),
      (16, 'DCASING_DBL_LG_EA', 'Door Casing - Double Large',        'Door Casing',   'Double Large',     17.00::numeric, 13.00::numeric, 12.00::numeric,  null::text, 'Y'),
      (17, 'DCASING_BIFOLD_EA', 'Door Casing - Bifold',              'Door Casing',   'Bifold',            8.00::numeric,  7.00::numeric,  6.00::numeric,  null::text, 'Y'),
      (18, 'DCASING_SLIDING_EA','Door Casing - Sliding',             'Door Casing',   'Sliding',          10.00::numeric,  8.00::numeric,  7.00::numeric,  null::text, 'Y'),
      (19, 'FIREPLACE_EA',      'Fireplace - Standard Surround',     'Fireplace',     'Standard Surround',20.00::numeric, 15.00::numeric, 13.00::numeric,  null::text, 'Y')
  ) as rows (
    sort_order,
    row_id,
    display_name,
    surface_type,
    condition,
    prep_minutes,
    paint_minutes,
    primer_minutes,
    notes,
    active
  )
)
insert into public.estimator_template_constant_rows as rows (
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
  'production_rates_trim',
  s.row_id,
  s.display_name,
  s.active,
  s.sort_order,
  jsonb_build_object(
    'id', s.row_id,
    'production_scope', 'trim',
    'scope_id', 'TRIM',
    'display_name', s.display_name,
    'surface_type', s.surface_type,
    'condition', s.condition,
    'prep_sqft_per_hr', case when s.prep_minutes > 0 then round((60.0 / s.prep_minutes)::numeric, 2) else null end,
    'sqft_per_hr', case when s.paint_minutes > 0 then round((60.0 / s.paint_minutes)::numeric, 2) else null end,
    'primer_sqft_per_hr', case when s.primer_minutes > 0 then round((60.0 / s.primer_minutes)::numeric, 2) else null end,
    'notes', s.notes
  )
from ensure_template t
cross join source_rows s
on conflict (org_id, category_key, row_id) do update
set
  template_id = excluded.template_id,
  display_name = excluded.display_name,
  active = excluded.active,
  sort_order = excluded.sort_order,
  values_json = excluded.values_json,
  updated_at = now();

update public.estimator_template_constants
set
  version = version + 1,
  updated_at = now()
where org_id = coalesce(
  (
    select m.org_id
    from public.org_members m
    where m.user_id = auth.uid()
    order by m.created_at asc nulls last, m.org_id asc
    limit 1
  ),
  (
    select o.id
    from public.orgs o
    where o.name = 'ACE Painting'
    order by o.created_at asc nulls last, o.id asc
    limit 1
  )
);
