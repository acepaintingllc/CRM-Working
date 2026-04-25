-- Persist trim applicator planning through the existing estimate_rollers collection.
-- The table stores shared applicator size/quantity/notes planning for walls, ceilings, and trim.

alter table public.estimate_rollers
  drop constraint if exists estimate_rollers_scope_check;

alter table public.estimate_rollers
  add constraint estimate_rollers_scope_check
  check (scope in ('Wall', 'Ceiling', 'Trim'));

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

  create temporary table if not exists _trim_applicator_touched_orgs (
    org_id uuid primary key
  ) on commit drop;
  truncate table _trim_applicator_touched_orgs;

  with templates as (
    select id as template_id, org_id
    from public.estimator_template_constants
  ),
  canonical(row_id, display_name, size_in, price_each, sort_order) as (
    values
      ('TRIM_4', 'Trim applicator', '4', '4', 6),
      ('TRIM_6', 'Trim applicator', '6', '5', 7)
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
      'supply_rates_roller_covers',
      c.row_id,
      c.display_name,
      'Y',
      c.sort_order,
      jsonb_build_object(
        'id', c.row_id,
        'display_name', c.display_name,
        'supply_group', 'roller_covers',
        'scope', 'Trim',
        'unit', 'each',
        'cost_per', '',
        'size_in', c.size_in,
        'price_each', c.price_each,
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
  insert into _trim_applicator_touched_orgs (org_id)
  select distinct org_id
  from upserted
  on conflict (org_id) do nothing;

  if exists (select 1 from _trim_applicator_touched_orgs) then
    update public.estimator_template_constants t
    set version = greatest(1, coalesce(t.version, 0) + 1)
    where t.org_id in (select org_id from _trim_applicator_touched_orgs);

    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'estimate_catalog_snapshots'
        and c.relkind = 'r'
    ) then
      delete from public.estimate_catalog_snapshots s
      where s.org_id in (select org_id from _trim_applicator_touched_orgs);
    end if;
  end if;
end $$;
