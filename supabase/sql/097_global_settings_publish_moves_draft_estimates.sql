-- Publish global estimator settings and move only draft estimate versions.
-- Historical/customer-visible estimates stay pinned to their existing setting set.

create or replace function public.activate_estimator_setting_set(
  p_org_id uuid,
  p_setting_set_id uuid,
  p_actor_id uuid,
  p_reason text default '',
  p_source text default 'manual'
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_draft public.estimator_setting_set%rowtype;
  v_active public.estimator_setting_set%rowtype;
  v_now timestamptz := now();
  v_draft_estimates_updated integer := 0;
begin
  select *
  into v_draft
  from public.estimator_setting_set
  where org_id = p_org_id
    and id = p_setting_set_id
  for update;

  if not found then
    raise exception 'Setting set not found.' using errcode = 'P0002';
  end if;

  if v_draft.status <> 'draft' then
    raise exception 'Only draft setting sets can be activated.' using errcode = '22023';
  end if;

  select *
  into v_active
  from public.estimator_setting_set
  where org_id = p_org_id
    and status = 'active'
    and id <> p_setting_set_id
  order by version_number desc, created_at desc
  limit 1
  for update;

  if found then
    update public.estimator_setting_set
    set
      status = 'retired',
      retired_by = p_actor_id,
      retired_at = v_now
    where org_id = p_org_id
      and id = v_active.id;
  end if;

  update public.estimator_setting_set
  set
    status = 'active',
    activated_by = p_actor_id,
    activated_at = v_now
  where org_id = p_org_id
    and id = p_setting_set_id
  returning *
  into v_draft;

  update public.estimates
  set
    setting_set_id_used = p_setting_set_id,
    updated_at = v_now
  where org_id = p_org_id
    and version_state = 'draft'
    and coalesce(setting_set_id_used, '00000000-0000-0000-0000-000000000000'::uuid) <> p_setting_set_id;

  get diagnostics v_draft_estimates_updated = row_count;

  insert into public.setting_change_log (
    org_id,
    previous_setting_set_id,
    new_setting_set_id,
    target_key,
    old_value_json,
    new_value_json,
    source,
    reason,
    actor_id
  )
  values (
    p_org_id,
    case when v_active.id is null then null else v_active.id end,
    p_setting_set_id,
    'setting_set.activation',
    case
      when v_active.id is null then null
      else jsonb_build_object('version_number', v_active.version_number)
    end,
    jsonb_build_object(
      'version_number', v_draft.version_number,
      'draft_estimates_updated', v_draft_estimates_updated
    ),
    coalesce(nullif(p_source, ''), 'manual'),
    coalesce(p_reason, ''),
    p_actor_id
  );

  return jsonb_build_object(
    'setting_set', to_jsonb(v_draft),
    'draft_estimates_updated', v_draft_estimates_updated
  );
end;
$$;

revoke all on function public.activate_estimator_setting_set(uuid, uuid, uuid, text, text) from public;
revoke all on function public.activate_estimator_setting_set(uuid, uuid, uuid, text, text) from anon;
revoke all on function public.activate_estimator_setting_set(uuid, uuid, uuid, text, text) from authenticated;
grant execute on function public.activate_estimator_setting_set(uuid, uuid, uuid, text, text) to service_role;

create or replace function public.publish_estimator_rates_flags_batch(
  p_org_id uuid,
  p_actor_id uuid,
  p_mutations jsonb,
  p_reason text default '',
  p_source text default 'rates_flags_batch_publish'
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_active public.estimator_setting_set%rowtype;
  v_previous_active public.estimator_setting_set%rowtype;
  v_new_active public.estimator_setting_set%rowtype;
  v_mutation jsonb;
  v_values jsonb;
  v_category text;
  v_action text;
  v_original_row_id text;
  v_next_row_id text;
  v_display_name text;
  v_next_active boolean;
  v_next_version integer;
  v_now timestamptz := now();
  v_draft_estimates_updated integer := 0;
begin
  if p_mutations is null or jsonb_typeof(p_mutations) <> 'array' then
    raise exception 'mutations payload must be a JSON array' using errcode = '22023';
  end if;

  if jsonb_array_length(p_mutations) = 0 then
    raise exception 'At least one mutation is required.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('estimator_setting_set:' || p_org_id::text));

  select *
  into v_active
  from public.estimator_setting_set
  where org_id = p_org_id
    and status = 'active'
  order by version_number desc, created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'No active estimator setting set found.' using errcode = 'P0002';
  end if;

  create temporary table if not exists rates_flags_batch_rows (
    category_key text not null,
    row_id text not null,
    primary key (category_key, row_id)
  ) on commit drop;

  truncate table rates_flags_batch_rows;

  insert into rates_flags_batch_rows (category_key, row_id)
  select value.category_key, value.row_id
  from public.estimator_setting_value value
  where value.org_id = p_org_id
    and value.setting_set_id = v_active.id
    and value.row_id is not null;

  for v_mutation in select value from jsonb_array_elements(p_mutations)
  loop
    v_category := nullif(btrim(v_mutation ->> 'category'), '');
    v_action := nullif(btrim(v_mutation ->> 'action'), '');

    if v_category is null or v_action is null then
      raise exception 'Mutation must include category and action.' using errcode = '22023';
    end if;

    if v_action in ('archive', 'reactivate') then
      v_original_row_id := nullif(btrim(v_mutation ->> 'rowId'), '');
      if v_original_row_id is null then
        raise exception 'Mutation must include rowId for archive/reactivate.' using errcode = '22023';
      end if;

      if not exists (
        select 1
        from rates_flags_batch_rows
        where category_key = v_category
          and row_id = v_original_row_id
      ) then
        raise exception 'Row not found.' using errcode = 'P0002';
      end if;
      continue;
    end if;

    if v_action not in ('create', 'update') then
      raise exception 'Unsupported mutation action.' using errcode = '22023';
    end if;

    v_values := v_mutation -> 'values';
    if v_values is null or jsonb_typeof(v_values) <> 'object' then
      raise exception 'Mutation values must be an object.' using errcode = '22023';
    end if;

    v_next_row_id := nullif(btrim(v_values ->> 'id'), '');
    v_original_row_id := coalesce(nullif(btrim(v_mutation ->> 'original_id'), ''), v_next_row_id);

    if v_next_row_id is null or v_original_row_id is null then
      raise exception 'Missing row id.' using errcode = '22023';
    end if;

    if v_action = 'create' then
      if exists (
        select 1
        from rates_flags_batch_rows
        where category_key = v_category
          and row_id = v_next_row_id
      ) then
        raise exception 'Row "%" already exists.', v_next_row_id using errcode = '23505';
      end if;

      insert into rates_flags_batch_rows (category_key, row_id)
      values (v_category, v_next_row_id);
      continue;
    end if;

    if not exists (
      select 1
      from rates_flags_batch_rows
      where category_key = v_category
        and row_id = v_original_row_id
    ) then
      raise exception 'Row not found.' using errcode = 'P0002';
    end if;

    if v_next_row_id <> v_original_row_id
      and exists (
        select 1
        from rates_flags_batch_rows
        where category_key = v_category
          and row_id = v_next_row_id
      )
    then
      raise exception 'Row "%" already exists.', v_next_row_id using errcode = '23505';
    end if;

    delete from rates_flags_batch_rows
    where category_key = v_category
      and row_id = v_original_row_id;

    insert into rates_flags_batch_rows (category_key, row_id)
    values (v_category, v_next_row_id);
  end loop;

  select coalesce(max(version_number), 0) + 1
  into v_next_version
  from public.estimator_setting_set
  where org_id = p_org_id;

  insert into public.estimator_setting_set (
    org_id,
    version_number,
    status,
    source_set_id,
    created_by,
    notes
  )
  values (
    p_org_id,
    v_next_version,
    'draft',
    v_active.id,
    p_actor_id,
    'Rates/Flags batch publish'
  )
  returning *
  into v_new_active;

  insert into public.estimator_setting_value (
    org_id,
    setting_set_id,
    category_key,
    row_id,
    scalar_key,
    display_name,
    active,
    sort_order,
    value_json
  )
  select
    p_org_id,
    v_new_active.id,
    value.category_key,
    value.row_id,
    value.scalar_key,
    value.display_name,
    value.active,
    value.sort_order,
    coalesce(value.value_json, '{}'::jsonb)
  from public.estimator_setting_value value
  where value.org_id = p_org_id
    and value.setting_set_id = v_active.id;

  for v_mutation in select value from jsonb_array_elements(p_mutations)
  loop
    v_category := v_mutation ->> 'category';
    v_action := v_mutation ->> 'action';

    if v_action in ('archive', 'reactivate') then
      v_original_row_id := v_mutation ->> 'rowId';
      update public.estimator_setting_value
      set active = (v_action = 'reactivate')
      where org_id = p_org_id
        and setting_set_id = v_new_active.id
        and category_key = v_category
        and row_id = v_original_row_id;
      continue;
    end if;

    v_values := v_mutation -> 'values';
    v_next_row_id := v_values ->> 'id';
    v_original_row_id := coalesce(nullif(v_mutation ->> 'original_id', ''), v_next_row_id);
    v_display_name := coalesce(nullif(v_values ->> 'display_name', ''), v_next_row_id);
    v_next_active := upper(coalesce(nullif(v_values ->> 'active', ''), 'N')) = 'Y';

    if v_action = 'create' then
      insert into public.estimator_setting_value (
        org_id,
        setting_set_id,
        category_key,
        row_id,
        scalar_key,
        display_name,
        active,
        sort_order,
        value_json
      )
      values (
        p_org_id,
        v_new_active.id,
        v_category,
        v_next_row_id,
        null,
        v_display_name,
        v_next_active,
        coalesce(
          (
            select max(value.sort_order) + 1
            from public.estimator_setting_value value
            where value.org_id = p_org_id
              and value.setting_set_id = v_new_active.id
              and value.category_key = v_category
          ),
          0
        ),
        v_values - 'active'
      );
      continue;
    end if;

    update public.estimator_setting_value
    set
      row_id = v_next_row_id,
      display_name = v_display_name,
      active = v_next_active,
      value_json = v_values - 'active'
    where org_id = p_org_id
      and setting_set_id = v_new_active.id
      and category_key = v_category
      and row_id = v_original_row_id;
  end loop;

  v_previous_active := v_active;

  update public.estimator_setting_set
  set
    status = 'retired',
    retired_by = p_actor_id,
    retired_at = v_now
  where org_id = p_org_id
    and id = v_previous_active.id;

  update public.estimator_setting_set
  set
    status = 'active',
    activated_by = p_actor_id,
    activated_at = v_now
  where org_id = p_org_id
    and id = v_new_active.id
  returning *
  into v_new_active;

  update public.estimates
  set
    setting_set_id_used = v_new_active.id,
    updated_at = v_now
  where org_id = p_org_id
    and version_state = 'draft'
    and coalesce(setting_set_id_used, '00000000-0000-0000-0000-000000000000'::uuid) <> v_new_active.id;

  get diagnostics v_draft_estimates_updated = row_count;

  insert into public.setting_change_log (
    org_id,
    previous_setting_set_id,
    new_setting_set_id,
    target_key,
    old_value_json,
    new_value_json,
    source,
    reason,
    actor_id
  )
  values (
    p_org_id,
    v_previous_active.id,
    v_new_active.id,
    'setting_set.activation',
    jsonb_build_object('version_number', v_previous_active.version_number),
    jsonb_build_object(
      'version_number', v_new_active.version_number,
      'draft_estimates_updated', v_draft_estimates_updated
    ),
    coalesce(nullif(p_source, ''), 'rates_flags_batch_publish'),
    coalesce(p_reason, ''),
    p_actor_id
  );

  return jsonb_build_object(
    'setting_set_id', v_new_active.id,
    'version_number', v_new_active.version_number,
    'draft_estimates_updated', v_draft_estimates_updated
  );
end;
$$;

revoke all on function public.publish_estimator_rates_flags_batch(uuid, uuid, jsonb, text, text) from public;
revoke all on function public.publish_estimator_rates_flags_batch(uuid, uuid, jsonb, text, text) from anon;
revoke all on function public.publish_estimator_rates_flags_batch(uuid, uuid, jsonb, text, text) from authenticated;
grant execute on function public.publish_estimator_rates_flags_batch(uuid, uuid, jsonb, text, text) to service_role;
