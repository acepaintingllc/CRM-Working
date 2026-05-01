-- Backfill editable trim type rows from trim production rows.
-- The room trim input now reads CAT_TrimItems / unit_rates_trim for its type list,
-- while each trim type links back to the matching trim production rate.

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

  create temporary table if not exists _trim_type_backfill_touched_orgs (
    org_id uuid primary key
  ) on commit drop;
  truncate table _trim_type_backfill_touched_orgs;

  with source_rows as (
    select
      r.org_id,
      r.template_id,
      r.row_id,
      r.display_name,
      r.active,
      r.sort_order,
      coalesce(r.values_json, '{}'::jsonb) as values_json
    from public.estimator_template_constant_rows r
    where r.category_key = 'production_rates_trim'
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
      s.org_id,
      s.template_id,
      'unit_rates_trim',
      upper(coalesce(nullif(s.values_json->>'id', ''), s.row_id)),
      coalesce(nullif(s.values_json->>'display_name', ''), s.display_name, s.row_id),
      s.active,
      s.sort_order,
      jsonb_build_object(
        'unit_rate_group', 'trim',
        'id', upper(coalesce(nullif(s.values_json->>'id', ''), s.row_id)),
        'display_name', coalesce(nullif(s.values_json->>'display_name', ''), s.display_name, s.row_id),
        'unit_rate_type', coalesce(nullif(s.values_json->>'surface_type', ''), ''),
        'unit',
          case
            when upper(coalesce(nullif(s.values_json->>'id', ''), s.row_id, s.display_name, '')) like '%_EA'
              or upper(coalesce(s.display_name, '')) like '% EA' then 'EA'
            when upper(coalesce(nullif(s.values_json->>'id', ''), s.row_id, s.display_name, '')) like '%_SF'
              or upper(coalesce(s.display_name, '')) like '% SF' then 'SF'
            else 'LF'
          end,
        'helper_allowed',
          case
            when upper(coalesce(s.values_json->>'surface_type', s.display_name, s.row_id, '')) like '%BASEBOARD%'
              and (
                upper(coalesce(nullif(s.values_json->>'id', ''), s.row_id, s.display_name, '')) like '%_LF'
                or upper(coalesce(s.display_name, '')) like '% LF'
              )
            then 'Y'
            else 'N'
          end,
        'default_production_rate_id', upper(coalesce(nullif(s.values_json->>'id', ''), s.row_id)),
        'default_qty', '',
        'labor_rate', '',
        'material_rate', '',
        'amount', '',
        'notes', coalesce(s.values_json->>'notes', '')
      )
    from source_rows s
    on conflict (org_id, category_key, row_id) do nothing
    returning rows.org_id
  )
  insert into _trim_type_backfill_touched_orgs (org_id)
  select distinct org_id from upserted
  on conflict (org_id) do nothing;

  update public.estimator_template_constants t
  set version = greatest(1, coalesce(t.version, 0) + 1),
      updated_at = now()
  where t.org_id in (select org_id from _trim_type_backfill_touched_orgs);
end $$;
