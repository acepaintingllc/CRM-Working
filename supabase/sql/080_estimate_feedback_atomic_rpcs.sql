-- Atomic helpers for the estimate feedback loop.
-- These keep immutable snapshots and setting-set activation from being split
-- across multiple client-side Supabase calls.

create or replace function public.insert_estimate_snapshot_with_lines(
  p_snapshot jsonb,
  p_lines jsonb
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_existing public.estimate_snapshot%rowtype;
  v_inserted public.estimate_snapshot%rowtype;
  v_line_count integer;
begin
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then
    raise exception 'snapshot payload must be a JSON object' using errcode = '22023';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'snapshot lines payload must be a JSON array' using errcode = '22023';
  end if;

  select *
  into v_existing
  from public.estimate_snapshot
  where org_id = (p_snapshot ->> 'org_id')::uuid
    and estimate_id = (p_snapshot ->> 'estimate_id')::uuid;

  if found then
    if not exists (
      select 1
      from public.estimate_snapshot_line line
      where line.snapshot_id = v_existing.id
        and line.line_key = 'summary:job-total'
    ) then
      raise exception 'existing estimate snapshot is incomplete'
        using errcode = '55000';
    end if;

    return to_jsonb(v_existing);
  end if;

  insert into public.estimate_snapshot (
    org_id,
    job_id,
    estimate_id,
    customer_id,
    accepted_public_version_id,
    setting_set_id_used,
    snapshot_created_reason,
    estimate_version_name,
    estimate_version_state,
    estimate_version_kind,
    estimated_labor_hours,
    estimated_paint_gallons,
    estimated_primer_gallons,
    estimated_paint_material_cost,
    estimated_supplies_cost,
    estimated_other_cost,
    estimated_access_cost,
    estimated_total,
    assumptions_json,
    totals_json,
    source_payload_json,
    created_by
  )
  values (
    (p_snapshot ->> 'org_id')::uuid,
    (p_snapshot ->> 'job_id')::uuid,
    (p_snapshot ->> 'estimate_id')::uuid,
    (p_snapshot ->> 'customer_id')::uuid,
    nullif(p_snapshot ->> 'accepted_public_version_id', '')::uuid,
    nullif(p_snapshot ->> 'setting_set_id_used', '')::uuid,
    p_snapshot ->> 'snapshot_created_reason',
    nullif(p_snapshot ->> 'estimate_version_name', ''),
    nullif(p_snapshot ->> 'estimate_version_state', ''),
    nullif(p_snapshot ->> 'estimate_version_kind', ''),
    coalesce((p_snapshot ->> 'estimated_labor_hours')::numeric, 0),
    coalesce((p_snapshot ->> 'estimated_paint_gallons')::numeric, 0),
    coalesce((p_snapshot ->> 'estimated_primer_gallons')::numeric, 0),
    coalesce((p_snapshot ->> 'estimated_paint_material_cost')::numeric, 0),
    coalesce((p_snapshot ->> 'estimated_supplies_cost')::numeric, 0),
    coalesce((p_snapshot ->> 'estimated_other_cost')::numeric, 0),
    coalesce((p_snapshot ->> 'estimated_access_cost')::numeric, 0),
    coalesce((p_snapshot ->> 'estimated_total')::numeric, 0),
    coalesce(p_snapshot -> 'assumptions_json', '{}'::jsonb),
    coalesce(p_snapshot -> 'totals_json', '{}'::jsonb),
    coalesce(p_snapshot -> 'source_payload_json', '{}'::jsonb),
    nullif(p_snapshot ->> 'created_by', '')::uuid
  )
  returning *
  into v_inserted;

  insert into public.estimate_snapshot_line (
    snapshot_id,
    org_id,
    job_id,
    estimate_id,
    line_key,
    line_kind,
    room_id,
    source_table,
    source_row_id,
    label,
    position,
    estimated_labor_hours,
    estimated_paint_gallons,
    estimated_primer_gallons,
    estimated_material_cost,
    estimated_supply_cost,
    estimated_total,
    assumptions_json,
    output_json
  )
  select
    v_inserted.id,
    (line.value ->> 'org_id')::uuid,
    (line.value ->> 'job_id')::uuid,
    (line.value ->> 'estimate_id')::uuid,
    line.value ->> 'line_key',
    line.value ->> 'line_kind',
    nullif(line.value ->> 'room_id', ''),
    nullif(line.value ->> 'source_table', ''),
    nullif(line.value ->> 'source_row_id', ''),
    coalesce(nullif(line.value ->> 'label', ''), line.value ->> 'line_key'),
    coalesce((line.value ->> 'position')::integer, line.ordinality::integer - 1),
    coalesce((line.value ->> 'estimated_labor_hours')::numeric, 0),
    coalesce((line.value ->> 'estimated_paint_gallons')::numeric, 0),
    coalesce((line.value ->> 'estimated_primer_gallons')::numeric, 0),
    coalesce((line.value ->> 'estimated_material_cost')::numeric, 0),
    coalesce((line.value ->> 'estimated_supply_cost')::numeric, 0),
    coalesce((line.value ->> 'estimated_total')::numeric, 0),
    coalesce(line.value -> 'assumptions_json', '{}'::jsonb),
    coalesce(line.value -> 'output_json', '{}'::jsonb)
  from jsonb_array_elements(p_lines) with ordinality as line(value, ordinality);

  get diagnostics v_line_count = row_count;
  if v_line_count <> jsonb_array_length(p_lines) then
    raise exception 'snapshot line insert count mismatch' using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.estimate_snapshot_line line
    where line.snapshot_id = v_inserted.id
      and line.line_key = 'summary:job-total'
  ) then
    raise exception 'snapshot must include summary:job-total line'
      using errcode = '22023';
  end if;

  return to_jsonb(v_inserted);
exception
  when unique_violation then
    select *
    into v_existing
    from public.estimate_snapshot
    where org_id = (p_snapshot ->> 'org_id')::uuid
      and estimate_id = (p_snapshot ->> 'estimate_id')::uuid;

    if found and exists (
      select 1
      from public.estimate_snapshot_line line
      where line.snapshot_id = v_existing.id
        and line.line_key = 'summary:job-total'
    ) then
      return to_jsonb(v_existing);
    end if;

    raise;
end;
$$;

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
    jsonb_build_object('version_number', v_draft.version_number),
    coalesce(nullif(p_source, ''), 'manual'),
    coalesce(p_reason, ''),
    p_actor_id
  );

  return to_jsonb(v_draft);
end;
$$;

revoke all on function public.insert_estimate_snapshot_with_lines(jsonb, jsonb) from public;
revoke all on function public.insert_estimate_snapshot_with_lines(jsonb, jsonb) from anon;
revoke all on function public.insert_estimate_snapshot_with_lines(jsonb, jsonb) from authenticated;
grant execute on function public.insert_estimate_snapshot_with_lines(jsonb, jsonb) to service_role;

revoke all on function public.activate_estimator_setting_set(uuid, uuid, uuid, text, text) from public;
revoke all on function public.activate_estimator_setting_set(uuid, uuid, uuid, text, text) from anon;
revoke all on function public.activate_estimator_setting_set(uuid, uuid, uuid, text, text) from authenticated;
grant execute on function public.activate_estimator_setting_set(uuid, uuid, uuid, text, text) to service_role;
