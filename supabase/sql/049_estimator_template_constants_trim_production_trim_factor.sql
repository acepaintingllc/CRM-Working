-- Extend Rates/Flags taxonomy for trim production and trim room-flag factors.
-- Adds category_key `production_rates_trim` and ensures condition_modifiers rows
-- carry `trim_factor` in values_json.

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

  alter table public.estimator_template_constant_rows
    drop constraint if exists estimator_template_constant_rows_category_key_check;

  alter table public.estimator_template_constant_rows
    add constraint estimator_template_constant_rows_category_key_check
    check (
      category_key in (
        'production_rates_walls',
        'production_rates_ceilings',
        'production_rates_trim',
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
        -- compatibility keys
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
    );

  create temporary table if not exists _trim_rf_touched_orgs (
    org_id uuid primary key
  ) on commit drop;
  truncate table _trim_rf_touched_orgs;

  -- Move trim-scoped legacy production rows into the explicit trim category.
  with moved as (
    update public.estimator_template_constant_rows r
    set category_key = 'production_rates_trim'
    where r.category_key = 'production_rates'
      and (
        lower(coalesce(r.values_json->>'production_scope', '')) = 'trim'
        or upper(coalesce(r.values_json->>'scope_id', '')) = 'TRIM'
      )
    returning r.org_id
  )
  insert into _trim_rf_touched_orgs (org_id)
  select distinct org_id from moved
  on conflict (org_id) do nothing;

  -- Ensure condition modifiers include trim_factor (defaulting to wall_factor, then ceil_factor, then 1).
  with updated as (
    update public.estimator_template_constant_rows r
    set values_json = jsonb_set(
      coalesce(r.values_json, '{}'::jsonb),
      '{trim_factor}',
      to_jsonb(
        coalesce(
          nullif(r.values_json->>'trim_factor', ''),
          nullif(r.values_json->>'wall_factor', ''),
          nullif(r.values_json->>'ceil_factor', ''),
          '1'
        )
      ),
      true
    )
    where r.category_key = 'condition_modifiers'
      and coalesce(r.values_json->>'trim_factor', '') = ''
    returning r.org_id
  )
  insert into _trim_rf_touched_orgs (org_id)
  select distinct org_id from updated
  on conflict (org_id) do nothing;

  -- Seed canonical trim production rows so Rates > Production > Trim is usable by default.
  with templates as (
    select id as template_id, org_id
    from public.estimator_template_constants
  ),
  canonical(row_id, display_name, scope_id, surface_type, condition, prep_rate, paint_rate, primer_rate, sort_order) as (
    values
      ('TRIM_BASE_STD', 'Trim - Baseboard LF', 'TRIM', 'BASEBOARD', 'STANDARD', '60', '90', '75', 0),
      ('TRIM_CASING_STD', 'Trim - Casing EA', 'TRIM', 'CASING', 'STANDARD', '18', '30', '24', 1),
      ('TRIM_WAINSCOT_STD', 'Trim - Wainscot SF', 'TRIM', 'WAINSCOT', 'STANDARD', '45', '70', '58', 2)
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
      'production_rates_trim',
      c.row_id,
      c.display_name,
      'Y',
      c.sort_order,
      jsonb_build_object(
        'id', c.row_id,
        'production_scope', 'trim',
        'scope_id', c.scope_id,
        'display_name', c.display_name,
        'surface_type', c.surface_type,
        'condition', c.condition,
        'prep_sqft_per_hr', c.prep_rate,
        'sqft_per_hr', c.paint_rate,
        'primer_sqft_per_hr', c.primer_rate,
        'notes', ''
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
  insert into _trim_rf_touched_orgs (org_id)
  select distinct org_id from upserted
  on conflict (org_id) do nothing;

  update public.estimator_template_constants t
  set version = greatest(1, coalesce(t.version, 0) + 1),
      updated_at = now()
  where t.org_id in (select org_id from _trim_rf_touched_orgs);
end $$;
