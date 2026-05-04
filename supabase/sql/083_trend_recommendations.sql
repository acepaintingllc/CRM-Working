-- Rule-based recommendation records generated from locked review trends.
-- Applying recommendations is intentionally handled by a later workflow.

create table if not exists public.trend_recommendation (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  target_setting_key text not null,
  current_value_json jsonb not null default '{}'::jsonb,
  suggested_value_json jsonb not null default '{}'::jsonb,
  reason text not null,
  evidence_json jsonb not null default '{}'::jsonb,
  evidence_hash text not null,
  confidence_label text not null check (confidence_label in ('low', 'medium', 'high')),
  based_on_job_count integer not null default 0 check (based_on_job_count >= 0),
  status text not null default 'open' check (status in ('open', 'dismissed', 'applied', 'stale')),
  applied_setting_set_id uuid null references public.estimator_setting_set(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  applied_at timestamptz null,
  dismissed_at timestamptz null,
  constraint trend_recommendation_applied_status_check
    check (status <> 'applied' or applied_at is not null),
  constraint trend_recommendation_dismissed_status_check
    check (status <> 'dismissed' or dismissed_at is not null)
);

create unique index if not exists trend_recommendation_open_target_evidence_idx
  on public.trend_recommendation (org_id, target_setting_key, evidence_hash)
  where status = 'open';

create index if not exists trend_recommendation_org_status_created_idx
  on public.trend_recommendation (org_id, status, created_at desc);

create index if not exists trend_recommendation_applied_setting_set_idx
  on public.trend_recommendation (org_id, applied_setting_set_id)
  where applied_setting_set_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'setting_change_log_recommendation_fkey'
      and conrelid = 'public.setting_change_log'::regclass
  ) then
    alter table public.setting_change_log
      add constraint setting_change_log_recommendation_fkey
      foreign key (recommendation_id)
      references public.trend_recommendation(id)
      on delete set null
      not valid;
  end if;
end $$;

drop trigger if exists trg_trend_recommendation_set_updated_at on public.trend_recommendation;
create trigger trg_trend_recommendation_set_updated_at
before update on public.trend_recommendation
for each row
execute function public.set_updated_at();

alter table public.trend_recommendation enable row level security;

drop policy if exists trend_recommendation_select on public.trend_recommendation;
create policy trend_recommendation_select
  on public.trend_recommendation
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = trend_recommendation.org_id
    )
  );

drop policy if exists trend_recommendation_insert on public.trend_recommendation;
create policy trend_recommendation_insert
  on public.trend_recommendation
  for insert
  to authenticated
  with check (
    trend_recommendation.status <> 'applied'
    and
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = trend_recommendation.org_id
    )
  );

drop policy if exists trend_recommendation_update on public.trend_recommendation;
create policy trend_recommendation_update
  on public.trend_recommendation
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = trend_recommendation.org_id
    )
  )
  with check (
    trend_recommendation.status <> 'applied'
    and
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = trend_recommendation.org_id
    )
  );

create or replace function public.apply_trend_recommendation(
  p_org_id uuid,
  p_recommendation_id uuid,
  p_actor_id uuid
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_recommendation public.trend_recommendation%rowtype;
  v_active public.estimator_setting_set%rowtype;
  v_draft public.estimator_setting_set%rowtype;
  v_target_value public.estimator_setting_value%rowtype;
  v_draft_target_value public.estimator_setting_value%rowtype;
  v_target_parts text[];
  v_category_key text;
  v_target_identity text;
  v_field_key text;
  v_next_version integer;
  v_next_value_json jsonb;
  v_now timestamptz := now();
begin
  select *
  into v_recommendation
  from public.trend_recommendation
  where org_id = p_org_id
    and id = p_recommendation_id
  for update;

  if not found then
    raise exception 'Recommendation not found.' using errcode = 'P0002';
  end if;

  if v_recommendation.status <> 'open' then
    raise exception 'Recommendation is no longer open.' using errcode = '40900';
  end if;

  v_target_parts := string_to_array(v_recommendation.target_setting_key, ':');
  if array_length(v_target_parts, 1) <> 3 then
    raise exception 'Invalid target_setting_key.' using errcode = '22023';
  end if;

  v_category_key := v_target_parts[1];
  v_target_identity := v_target_parts[2];
  v_field_key := v_target_parts[3];

  if v_category_key = 'scalar_defaults' and v_field_key <> 'value' then
    raise exception 'Scalar target keys must use the value field.' using errcode = '22023';
  end if;

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

  if v_category_key = 'scalar_defaults' then
    select *
    into v_target_value
    from public.estimator_setting_value
    where org_id = p_org_id
      and setting_set_id = v_active.id
      and category_key = v_category_key
      and scalar_key = v_target_identity
      and active = true
    limit 1
    for update;
  else
    select *
    into v_target_value
    from public.estimator_setting_value
    where org_id = p_org_id
      and setting_set_id = v_active.id
      and category_key = v_category_key
      and row_id = v_target_identity
      and active = true
    limit 1
    for update;
  end if;

  if not found or exists (
    select 1
    from jsonb_each(v_recommendation.current_value_json) expected(key, value)
    where not (
      v_target_value.value_json ? expected.key
      and (
        v_target_value.value_json -> expected.key = expected.value
        or (
          (v_target_value.value_json ->> expected.key) ~ '^-?[0-9]+(\.[0-9]+)?$'
          and (expected.value #>> '{}') ~ '^-?[0-9]+(\.[0-9]+)?$'
          and (v_target_value.value_json ->> expected.key)::numeric = (expected.value #>> '{}')::numeric
        )
      )
    )
  ) then
    update public.trend_recommendation
    set
      status = 'stale',
      applied_setting_set_id = null,
      applied_at = null,
      dismissed_at = null
    where org_id = p_org_id
      and id = p_recommendation_id
    returning *
    into v_recommendation;

    return to_jsonb(v_recommendation);
  end if;

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
    'Apply recommendation ' || p_recommendation_id::text
  )
  returning *
  into v_draft;

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
    org_id,
    v_draft.id,
    category_key,
    row_id,
    scalar_key,
    display_name,
    active,
    sort_order,
    coalesce(value_json, '{}'::jsonb)
  from public.estimator_setting_value
  where org_id = p_org_id
    and setting_set_id = v_active.id;

  if v_category_key = 'scalar_defaults' then
    select *
    into v_draft_target_value
    from public.estimator_setting_value
    where org_id = p_org_id
      and setting_set_id = v_draft.id
      and category_key = v_category_key
      and scalar_key = v_target_identity
      and active = true
    limit 1
    for update;
  else
    select *
    into v_draft_target_value
    from public.estimator_setting_value
    where org_id = p_org_id
      and setting_set_id = v_draft.id
      and category_key = v_category_key
      and row_id = v_target_identity
      and active = true
    limit 1
    for update;
  end if;

  if not found then
    raise exception 'Unable to clone recommendation target setting value.'
      using errcode = '55000';
  end if;

  v_next_value_json :=
    coalesce(v_draft_target_value.value_json, '{}'::jsonb)
    || coalesce(v_recommendation.suggested_value_json, '{}'::jsonb);

  update public.estimator_setting_value
  set value_json = v_next_value_json
  where org_id = p_org_id
    and id = v_draft_target_value.id;

  perform public.activate_estimator_setting_set(
    p_org_id,
    v_draft.id,
    p_actor_id,
    v_recommendation.reason,
    'trend_recommendation'
  );

  insert into public.setting_change_log (
    org_id,
    previous_setting_set_id,
    new_setting_set_id,
    target_key,
    old_value_json,
    new_value_json,
    source,
    reason,
    actor_id,
    recommendation_id
  )
  values (
    p_org_id,
    v_active.id,
    v_draft.id,
    v_recommendation.target_setting_key,
    v_recommendation.current_value_json,
    v_recommendation.suggested_value_json,
    'trend_recommendation',
    v_recommendation.reason,
    p_actor_id,
    v_recommendation.id
  );

  update public.trend_recommendation
  set
    status = 'applied',
    applied_setting_set_id = v_draft.id,
    applied_at = v_now,
    dismissed_at = null
  where org_id = p_org_id
    and id = p_recommendation_id
  returning *
  into v_recommendation;

  return to_jsonb(v_recommendation);
end;
$$;

revoke all on table public.trend_recommendation from public;
revoke all on table public.trend_recommendation from anon;
grant select, insert, update on table public.trend_recommendation to authenticated;
grant select, insert, update, delete on table public.trend_recommendation to service_role;

revoke all on function public.apply_trend_recommendation(uuid, uuid, uuid) from public;
revoke all on function public.apply_trend_recommendation(uuid, uuid, uuid) from anon;
revoke all on function public.apply_trend_recommendation(uuid, uuid, uuid) from authenticated;
grant execute on function public.apply_trend_recommendation(uuid, uuid, uuid) to service_role;
