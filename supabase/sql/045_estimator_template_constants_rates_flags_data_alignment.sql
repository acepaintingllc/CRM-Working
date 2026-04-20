-- Canonical Rates/Flags data alignment for seeded estimator template constants.
-- Idempotent and safe to re-run.

do $$
begin
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'estimator_template_constant_rows'
      and c.relkind = 'r'
  ) then
    return;
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'estimator_template_constants'
      and c.relkind = 'r'
  ) then
    return;
  end if;

  create temporary table if not exists _rf_touched_orgs (
    org_id uuid primary key
  ) on commit drop;
  truncate table _rf_touched_orgs;

  -- Move known access-fee IDs to canonical groups while preserving amount/unit/fee_type/notes.
  with access_targets(row_id, target_category, access_group, target_sort) as (
    values
      ('26LADDER_EXT', 'access_fees_ladders', 'ladders', 0),
      ('SMALL_EXT', 'access_fees_ladders', 'ladders', 1),
      ('10FT_STEP', 'access_fees_ladders', 'ladders', 2),
      ('ROLLING_SCAFFOLD_1LVL', 'access_fees_scaffolding', 'scaffolding', 0),
      ('ROLLING_SCAFFOLD_2LVL', 'access_fees_scaffolding', 'scaffolding', 1)
  ),
  moved as (
    update public.estimator_template_constant_rows r
    set
      category_key = t.target_category,
      sort_order = t.target_sort,
      values_json = jsonb_set(
        jsonb_set(
          jsonb_set(
            coalesce(r.values_json, '{}'::jsonb),
            '{access_group}',
            to_jsonb(t.access_group),
            true
          ),
          '{id}',
          to_jsonb(r.row_id),
          true
        ),
        '{display_name}',
        to_jsonb(coalesce(nullif(r.values_json->>'display_name', ''), r.display_name)),
        true
      )
    from access_targets t
    where r.row_id = t.row_id
      and r.category_key in (
        'access_fees_ladders',
        'access_fees_scaffolding',
        'access_fees_specialty',
        'access_fees',
        'fixed_fees'
      )
      and (
        r.category_key is distinct from t.target_category
        or r.sort_order is distinct from t.target_sort
        or coalesce(r.values_json->>'access_group', '') is distinct from t.access_group
        or coalesce(r.values_json->>'id', '') is distinct from r.row_id
      )
    returning r.org_id
  )
  insert into _rf_touched_orgs (org_id)
  select distinct org_id
  from moved
  on conflict (org_id) do nothing;

  -- Specialty is intentionally blank for now.
  with archived as (
    update public.estimator_template_constant_rows r
    set active = 'N'
    where r.category_key = 'access_fees_specialty'
      and r.active = 'Y'
    returning r.org_id
  )
  insert into _rf_touched_orgs (org_id)
  select distinct org_id
  from archived
  on conflict (org_id) do nothing;

  -- Canonical supplies rows for seeded templates.
  with templates as (
    select id as template_id, org_id
    from public.estimator_template_constants
  ),
  canonical(
    category_key,
    row_id,
    display_name,
    supply_group,
    scope,
    unit,
    cost_per,
    size_in,
    price_each,
    notes,
    sort_order
  ) as (
    values
      ('supply_rates_per_color', 'BRUSH_WALL', 'Brush', 'per_color', 'Walls', '$/color', '5', '', '', '', 0),
      ('supply_rates_per_color', 'TRAY_WALL', 'Tray liner', 'per_color', 'Walls', '$/color', '1', '', '', '', 1),
      ('supply_rates_per_color', 'BRUSH_TRIM', 'Brush', 'per_color', 'Trim', '$/color', '5', '', '', '', 2),

      ('supply_rates_area_based', 'MISC_WALL', 'Misc consumables', 'area_based', 'Walls', '$/sqft', '0.06', '', '', '', 0),
      ('supply_rates_area_based', 'MISC_CEIL', 'Misc consumables', 'area_based', 'Ceilings', '$/sqft', '0.07', '', '', '', 1),

      ('supply_rates_per_job', 'BRUSH_CEIL', 'Brush', 'per_job', 'Ceilings', '$/job', '5', '', '', '', 0),
      ('supply_rates_per_job', 'TRAY_CEIL', 'Tray liner', 'per_job', 'Ceilings', '$/job', '1', '', '', '', 1),
      ('supply_rates_per_job', 'TAPE_MASK', 'Masking Tape', 'per_job', 'All', '$/job', '3', '', '', '', 2),
      ('supply_rates_per_job', 'DROP_CLOTH', 'Drop Cloth / Plastic', 'per_job', 'All', '$/job', '0', '', '', '', 3),

      ('supply_rates_roller_covers', 'WALL_9', 'Wall', 'roller_covers', 'Wall', 'each', '', '9', '6', '', 0),
      ('supply_rates_roller_covers', 'WALL_14', 'Wall', 'roller_covers', 'Wall', 'each', '', '14', '10', '', 1),
      ('supply_rates_roller_covers', 'WALL_18', 'Wall', 'roller_covers', 'Wall', 'each', '', '18', '12', '', 2),
      ('supply_rates_roller_covers', 'CEIL_9', 'Ceiling', 'roller_covers', 'Ceiling', 'each', '', '9', '6', '', 3),
      ('supply_rates_roller_covers', 'CEIL_14', 'Ceiling', 'roller_covers', 'Ceiling', 'each', '', '14', '10', '', 4),
      ('supply_rates_roller_covers', 'CEIL_18', 'Ceiling', 'roller_covers', 'Ceiling', 'each', '', '18', '12', '', 5)
  ),
  upserted as (
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
      t.template_id,
      c.category_key,
      c.row_id,
      c.display_name,
      'Y',
      c.sort_order,
      jsonb_build_object(
        'id', c.row_id,
        'display_name', c.display_name,
        'supply_group', c.supply_group,
        'scope', c.scope,
        'unit', c.unit,
        'cost_per', c.cost_per,
        'size_in', c.size_in,
        'price_each', c.price_each,
        'notes', c.notes
      )
    from templates t
    cross join canonical c
    on conflict (org_id, category_key, row_id) do update
    set
      template_id = excluded.template_id,
      display_name = excluded.display_name,
      active = excluded.active,
      sort_order = excluded.sort_order,
      values_json = excluded.values_json
    where
      rows.template_id is distinct from excluded.template_id
      or rows.display_name is distinct from excluded.display_name
      or rows.active is distinct from excluded.active
      or rows.sort_order is distinct from excluded.sort_order
      or rows.values_json is distinct from excluded.values_json
    returning rows.org_id
  )
  insert into _rf_touched_orgs (org_id)
  select distinct org_id
  from upserted
  on conflict (org_id) do nothing;

  -- Archive non-canonical active supply rows in managed supply categories.
  with canonical(category_key, row_id) as (
    values
      ('supply_rates_per_color', 'BRUSH_WALL'),
      ('supply_rates_per_color', 'TRAY_WALL'),
      ('supply_rates_per_color', 'BRUSH_TRIM'),
      ('supply_rates_area_based', 'MISC_WALL'),
      ('supply_rates_area_based', 'MISC_CEIL'),
      ('supply_rates_per_job', 'BRUSH_CEIL'),
      ('supply_rates_per_job', 'TRAY_CEIL'),
      ('supply_rates_per_job', 'TAPE_MASK'),
      ('supply_rates_per_job', 'DROP_CLOTH'),
      ('supply_rates_roller_covers', 'WALL_9'),
      ('supply_rates_roller_covers', 'WALL_14'),
      ('supply_rates_roller_covers', 'WALL_18'),
      ('supply_rates_roller_covers', 'CEIL_9'),
      ('supply_rates_roller_covers', 'CEIL_14'),
      ('supply_rates_roller_covers', 'CEIL_18')
  ),
  archived as (
    update public.estimator_template_constant_rows r
    set active = 'N'
    where r.category_key in (
      'supply_rates_per_color',
      'supply_rates_area_based',
      'supply_rates_per_job',
      'supply_rates_roller_covers'
    )
      and r.active = 'Y'
      and not exists (
        select 1
        from canonical c
        where c.category_key = r.category_key
          and c.row_id = r.row_id
      )
    returning r.org_id
  )
  insert into _rf_touched_orgs (org_id)
  select distinct org_id
  from archived
  on conflict (org_id) do nothing;

  -- Canonical height factors.
  with templates as (
    select id as template_id, org_id
    from public.estimator_template_constants
  ),
  canonical(
    row_id,
    display_name,
    min_height_ft,
    max_height_ft,
    primary_value,
    notes,
    sort_order
  ) as (
    values
      ('HF_0_10', '0-10 ft', '0', '10', '1.00', 'Standard', 0),
      ('HF_10_12', '10-12 ft', '10', '12', '1.15', 'Step Ladder', 1),
      ('HF_12_16', '12-16 ft', '12', '16', '1.30', 'Tall / Staging', 2),
      ('HF_16_PLUS', '16+ ft', '16', null, '1.50', 'Scaffold', 3)
  ),
  upserted as (
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
      t.template_id,
      'height_factors',
      c.row_id,
      c.display_name,
      'Y',
      c.sort_order,
      jsonb_build_object(
        'id', c.row_id,
        'display_name', c.display_name,
        'min_height_ft', c.min_height_ft,
        'max_height_ft', c.max_height_ft,
        'primary_value', c.primary_value,
        'notes', c.notes
      )
    from templates t
    cross join canonical c
    on conflict (org_id, category_key, row_id) do update
    set
      template_id = excluded.template_id,
      display_name = excluded.display_name,
      active = excluded.active,
      sort_order = excluded.sort_order,
      values_json = excluded.values_json
    where
      rows.template_id is distinct from excluded.template_id
      or rows.display_name is distinct from excluded.display_name
      or rows.active is distinct from excluded.active
      or rows.sort_order is distinct from excluded.sort_order
      or rows.values_json is distinct from excluded.values_json
    returning rows.org_id
  )
  insert into _rf_touched_orgs (org_id)
  select distinct org_id
  from upserted
  on conflict (org_id) do nothing;

  -- Archive non-canonical active height factors.
  with canonical(row_id) as (
    values
      ('HF_0_10'),
      ('HF_10_12'),
      ('HF_12_16'),
      ('HF_16_PLUS')
  ),
  archived as (
    update public.estimator_template_constant_rows r
    set active = 'N'
    where r.category_key = 'height_factors'
      and r.active = 'Y'
      and not exists (
        select 1
        from canonical c
        where c.row_id = r.row_id
      )
    returning r.org_id
  )
  insert into _rf_touched_orgs (org_id)
  select distinct org_id
  from archived
  on conflict (org_id) do nothing;

  if exists (select 1 from _rf_touched_orgs) then
    update public.estimator_template_constants t
    set version = greatest(1, coalesce(t.version, 0) + 1)
    where t.org_id in (select org_id from _rf_touched_orgs);

    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'estimate_catalog_snapshots'
        and c.relkind = 'r'
    ) then
      delete from public.estimate_catalog_snapshots s
      where s.org_id in (select org_id from _rf_touched_orgs);
    end if;
  end if;
end $$;
