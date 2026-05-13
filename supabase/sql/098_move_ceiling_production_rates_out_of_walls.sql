-- Correct ceiling production rows that were classified under wall production rates.
--
-- Earlier taxonomy migrations moved legacy `production_rates` rows into
-- `production_rates_walls` wholesale. Some orgs already had ceiling rows in
-- that legacy bucket, so the setting-set backfill preserved rows such as
-- CEIL_* under the wall category.

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
    create temporary table if not exists _ceiling_template_production_rows (
      id uuid primary key,
      org_id uuid not null,
      template_id uuid not null,
      row_id text not null,
      display_name text not null,
      active text not null,
      sort_order integer not null,
      values_json jsonb not null
    ) on commit drop;
    truncate table _ceiling_template_production_rows;

    insert into _ceiling_template_production_rows (
      id,
      org_id,
      template_id,
      row_id,
      display_name,
      active,
      sort_order,
      values_json
    )
    select
      r.id,
      r.org_id,
      r.template_id,
      r.row_id,
      r.display_name,
      r.active,
      r.sort_order,
      jsonb_set(
        coalesce(r.values_json, '{}'::jsonb),
        '{production_scope}',
        '"ceilings"'::jsonb,
        true
      ) as values_json
    from public.estimator_template_constant_rows r
    where r.category_key = 'production_rates_walls'
      and (
        lower(coalesce(r.values_json->>'production_scope', '')) in ('ceiling', 'ceilings')
        or upper(coalesce(r.values_json->>'scope_id', '')) in ('CEILING', 'CEILINGS')
        or upper(coalesce(r.row_id, '')) like 'CEIL%'
        or lower(coalesce(r.display_name, '')) like '%ceiling%'
        or lower(coalesce(r.values_json->>'display_name', '')) like '%ceiling%'
      );

    update public.estimator_template_constant_rows target
    set
      template_id = source.template_id,
      display_name = source.display_name,
      active = source.active,
      sort_order = source.sort_order,
      values_json = source.values_json,
      updated_at = now()
    from _ceiling_template_production_rows source
    where target.org_id = source.org_id
      and target.category_key = 'production_rates_ceilings'
      and target.row_id = source.row_id;

    update public.estimator_template_constant_rows target
    set
      category_key = 'production_rates_ceilings',
      values_json = source.values_json,
      updated_at = now()
    from _ceiling_template_production_rows source
    where target.id = source.id
      and not exists (
        select 1
        from public.estimator_template_constant_rows existing
        where existing.org_id = source.org_id
          and existing.category_key = 'production_rates_ceilings'
          and existing.row_id = source.row_id
      );

    delete from public.estimator_template_constant_rows wrong
    using _ceiling_template_production_rows source
    where wrong.id = source.id
      and wrong.category_key = 'production_rates_walls';

    update public.estimator_template_constants template
    set
      version = greatest(1, coalesce(template.version, 0) + 1),
      updated_at = now()
    where exists (
      select 1
      from _ceiling_template_production_rows source
      where source.org_id = template.org_id
    );
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'estimator_setting_value'
      and c.relkind = 'r'
  ) then
    create temporary table if not exists _ceiling_setting_production_values (
      id uuid primary key,
      org_id uuid not null,
      setting_set_id uuid not null,
      row_id text not null,
      display_name text not null,
      active boolean not null,
      sort_order integer not null,
      value_json jsonb not null
    ) on commit drop;
    truncate table _ceiling_setting_production_values;

    insert into _ceiling_setting_production_values (
      id,
      org_id,
      setting_set_id,
      row_id,
      display_name,
      active,
      sort_order,
      value_json
    )
    select
      v.id,
      v.org_id,
      v.setting_set_id,
      v.row_id,
      v.display_name,
      v.active,
      v.sort_order,
      jsonb_set(
        coalesce(v.value_json, '{}'::jsonb),
        '{production_scope}',
        '"ceilings"'::jsonb,
        true
      ) as value_json
    from public.estimator_setting_value v
    where v.category_key = 'production_rates_walls'
      and v.row_id is not null
      and (
        lower(coalesce(v.value_json->>'production_scope', '')) in ('ceiling', 'ceilings')
        or upper(coalesce(v.value_json->>'scope_id', '')) in ('CEILING', 'CEILINGS')
        or upper(coalesce(v.row_id, '')) like 'CEIL%'
        or lower(coalesce(v.display_name, '')) like '%ceiling%'
        or lower(coalesce(v.value_json->>'display_name', '')) like '%ceiling%'
      );

    update public.estimator_setting_value target
    set
      display_name = source.display_name,
      active = source.active,
      sort_order = source.sort_order,
      value_json = source.value_json,
      updated_at = now()
    from _ceiling_setting_production_values source
    where target.setting_set_id = source.setting_set_id
      and target.category_key = 'production_rates_ceilings'
      and target.row_id = source.row_id;

    update public.estimator_setting_value target
    set
      category_key = 'production_rates_ceilings',
      value_json = source.value_json,
      updated_at = now()
    from _ceiling_setting_production_values source
    where target.id = source.id
      and not exists (
        select 1
        from public.estimator_setting_value existing
        where existing.setting_set_id = source.setting_set_id
          and existing.category_key = 'production_rates_ceilings'
          and existing.row_id = source.row_id
      );

    delete from public.estimator_setting_value wrong
    using _ceiling_setting_production_values source
    where wrong.id = source.id
      and wrong.category_key = 'production_rates_walls';
  end if;
end $$;
