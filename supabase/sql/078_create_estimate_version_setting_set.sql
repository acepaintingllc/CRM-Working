-- Capture the active estimator setting set when creating new estimate versions.
-- The estimate row remains compatible with seeded estimate_jobsettings, while
-- setting_set_id_used becomes the canonical catalog/settings identity.

create or replace function public.create_estimate_version(
  p_org_id uuid,
  p_user_id uuid,
  p_job_id uuid,
  p_customer_id uuid default null,
  p_version_state text default null,
  p_version_kind text default null,
  p_version_name text default null,
  p_default_version_label text default 'Estimate Version',
  p_max_attempts integer default 5
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_job record;
  v_customer_id uuid;
  v_template record;
  v_setting_set_id uuid;
  v_setting_values jsonb := '{}'::jsonb;
  v_estimate public.estimates%rowtype;
  v_version_state text;
  v_version_kind text;
  v_version_name text;
  v_next_sort_order integer;
  v_max_attempts integer := greatest(coalesce(p_max_attempts, 5), 1);
  v_attempt integer := 0;
begin
  if p_job_id is null then
    return jsonb_build_object(
      'ok', false,
      'error_kind', 'invalid_input',
      'error_message', 'Invalid job_id'
    );
  end if;

  select j.id, j.customer_id
  into v_job
  from public.jobs j
  where j.org_id = p_org_id
    and j.id = p_job_id;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'error_kind', 'not_found',
      'error_message', 'Job not found'
    );
  end if;

  select c.id
  into v_customer_id
  from public.customers c
  where c.org_id = p_org_id
    and c.id = coalesce(p_customer_id, v_job.customer_id);

  if v_customer_id is null then
    return jsonb_build_object(
      'ok', false,
      'error_kind', 'not_found',
      'error_message', 'Customer not found'
    );
  end if;

  v_version_state := case lower(btrim(coalesce(p_version_state, '')))
    when 'live' then 'live'
    when 'archived' then 'archived'
    else 'draft'
  end;

  v_version_kind := case lower(btrim(coalesce(p_version_kind, '')))
    when 'alternate' then 'alternate'
    when 'split' then 'split'
    when 'combined' then 'combined'
    when 'revision' then 'revision'
    else 'standard'
  end;

  select *
  into v_template
  from public.estimate_template_settings
  where org_id = p_org_id;

  select active_set.id
  into v_setting_set_id
  from public.estimator_setting_set active_set
  where active_set.org_id = p_org_id
    and active_set.status = 'active'
  order by active_set.version_number desc, active_set.created_at desc
  limit 1;

  if v_setting_set_id is not null then
    select coalesce(
      jsonb_object_agg(values.scalar_key, values.value_json -> 'value'),
      '{}'::jsonb
    )
    into v_setting_values
    from public.estimator_setting_value values
    where values.org_id = p_org_id
      and values.setting_set_id = v_setting_set_id
      and values.category_key = 'scalar_defaults'
      and values.scalar_key is not null;
  end if;

  while v_attempt < v_max_attempts loop
    v_attempt := v_attempt + 1;

    select coalesce(max(e.version_sort_order), -1) + 1
    into v_next_sort_order
    from public.estimates e
    where e.org_id = p_org_id
      and e.job_id = p_job_id;

    v_version_name := nullif(btrim(coalesce(p_version_name, '')), '');
    if v_version_name is null then
      v_version_name := concat(
        coalesce(nullif(btrim(p_default_version_label), ''), 'Estimate Version'),
        ' ',
        v_next_sort_order + 1
      );
    end if;

    begin
      insert into public.estimates (
        org_id,
        job_id,
        customer_id,
        status,
        version_name,
        version_state,
        version_kind,
        version_sort_order,
        setting_set_id_used,
        created_by
      )
      values (
        p_org_id,
        p_job_id,
        v_customer_id,
        'draft',
        v_version_name,
        v_version_state,
        v_version_kind,
        v_next_sort_order,
        v_setting_set_id,
        p_user_id
      )
      returning *
      into v_estimate;

      insert into public.estimate_jobsettings (
        org_id,
        estimate_id,
        job_id,
        walls_paint_id,
        walls_primer_id,
        ceiling_paint_id,
        ceiling_primer_id,
        trim_paint_id,
        trim_primer_id,
        primer_id,
        labor_day_policy_enabled,
        dayhours,
        rounding_increment_hours,
        override_labor_rate,
        job_minimum_enabled,
        job_minimum_amount
      )
      values (
        p_org_id,
        v_estimate.id,
        p_job_id,
        coalesce(nullif(v_setting_values ->> 'walls_paint_id', ''), v_template.walls_paint_id),
        coalesce(nullif(v_setting_values ->> 'walls_primer_id', ''), v_template.walls_primer_id),
        coalesce(nullif(v_setting_values ->> 'ceiling_paint_id', ''), v_template.ceiling_paint_id),
        coalesce(nullif(v_setting_values ->> 'ceiling_primer_id', ''), v_template.ceiling_primer_id),
        coalesce(nullif(v_setting_values ->> 'trim_paint_id', ''), v_template.trim_paint_id),
        coalesce(nullif(v_setting_values ->> 'trim_primer_id', ''), v_template.trim_primer_id),
        coalesce(
          nullif(v_setting_values ->> 'walls_primer_id', ''),
          nullif(v_setting_values ->> 'ceiling_primer_id', ''),
          nullif(v_setting_values ->> 'trim_primer_id', ''),
          v_template.walls_primer_id,
          v_template.ceiling_primer_id,
          v_template.trim_primer_id
        ),
        coalesce((v_setting_values ->> 'labor_day_policy_enabled')::boolean, v_template.labor_day_policy_enabled, true),
        coalesce((v_setting_values ->> 'dayhours')::numeric, v_template.dayhours, 8),
        coalesce((v_setting_values ->> 'rounding_increment_hours')::numeric, v_template.rounding_increment_hours, 4),
        coalesce((v_setting_values ->> 'override_labor_rate')::numeric, v_template.override_labor_rate, 40),
        coalesce((v_setting_values ->> 'job_minimum_enabled')::boolean, v_template.job_minimum_enabled, false),
        coalesce((v_setting_values ->> 'job_minimum_amount')::numeric, v_template.job_minimum_amount, 0)
      );

      insert into public.estimate_pricing_policies (
        org_id,
        estimate_id,
        job_id,
        labor_day_policy_enabled,
        labor_day_minimum,
        labor_day_rounding_increment,
        job_minimum_enabled,
        job_minimum_amount
      )
      values (
        p_org_id,
        v_estimate.id,
        p_job_id,
        coalesce((v_setting_values ->> 'labor_day_policy_enabled')::boolean, v_template.labor_day_policy_enabled, true),
        1,
        coalesce((v_setting_values ->> 'rounding_increment_hours')::numeric, v_template.rounding_increment_hours, 4) / 8.0,
        coalesce((v_setting_values ->> 'job_minimum_enabled')::boolean, v_template.job_minimum_enabled, false),
        coalesce((v_setting_values ->> 'job_minimum_amount')::numeric, v_template.job_minimum_amount, 0)
      );

      return jsonb_build_object(
        'ok', true,
        'id', v_estimate.id,
        'estimate', jsonb_build_object(
          'id', v_estimate.id,
          'job_id', v_estimate.job_id,
          'customer_id', v_estimate.customer_id,
          'status', v_estimate.status,
          'version_name', v_estimate.version_name,
          'version_state', v_estimate.version_state,
          'version_kind', v_estimate.version_kind,
          'version_sort_order', v_estimate.version_sort_order,
          'setting_set_id_used', v_estimate.setting_set_id_used,
          'created_at', v_estimate.created_at,
          'updated_at', v_estimate.updated_at
        )
      );
    exception
      when unique_violation then
        if v_attempt >= v_max_attempts then
          return jsonb_build_object(
            'ok', false,
            'error_kind', 'conflict',
            'error_message', 'Another version was created at the same time. Please retry.'
          );
        end if;
    end;
  end loop;

  return jsonb_build_object(
    'ok', false,
    'error_kind', 'conflict',
    'error_message', 'Another version was created at the same time. Please retry.'
  );
end;
$$;

revoke all on function public.create_estimate_version(uuid, uuid, uuid, uuid, text, text, text, text, integer) from public;
revoke all on function public.create_estimate_version(uuid, uuid, uuid, uuid, text, text, text, text, integer) from anon;
revoke all on function public.create_estimate_version(uuid, uuid, uuid, uuid, text, text, text, text, integer) from authenticated;
grant execute on function public.create_estimate_version(uuid, uuid, uuid, uuid, text, text, text, text, integer) to service_role;
