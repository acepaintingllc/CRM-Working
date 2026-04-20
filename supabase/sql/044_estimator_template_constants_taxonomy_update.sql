-- Incremental update for estimator template constants taxonomy.
-- Use this when 043 was already applied before the Rates/Flags rearrangement update.

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'estimator_template_constant_rows'
      and c.relkind = 'r'
  ) then
    alter table public.estimator_template_constant_rows
      drop constraint if exists estimator_template_constant_rows_category_key_check;

    alter table public.estimator_template_constant_rows
      add constraint estimator_template_constant_rows_category_key_check
      check (
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

    -- Legacy key remaps for already-seeded org data.
    update public.estimator_template_constant_rows
    set
      category_key = 'access_fees_specialty',
      values_json = jsonb_set(
        coalesce(values_json, '{}'::jsonb),
        '{access_group}',
        '"specialty"'::jsonb,
        true
      )
    where category_key = 'fixed_fees';

    update public.estimator_template_constant_rows
    set
      category_key = 'supply_rates_area_based',
      values_json = jsonb_set(
        jsonb_set(
          coalesce(values_json, '{}'::jsonb),
          '{supply_group}',
          '"area_based"'::jsonb,
          true
        ),
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
        '"walls"'::jsonb,
        true
      )
    where category_key = 'production_rates';
  end if;
end $$;

