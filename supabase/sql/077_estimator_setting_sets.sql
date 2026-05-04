-- Estimator settings versioning foundation.
-- This migration creates immutable setting-set storage for future estimate settings
-- changes while keeping current mutable settings tables as compatibility sources.

create table if not exists public.estimator_setting_set (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  source_set_id uuid null references public.estimator_setting_set(id) on delete set null,
  created_by uuid null,
  activated_by uuid null,
  retired_by uuid null,
  activated_at timestamptz null,
  retired_at timestamptz null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, version_number),
  unique (id, org_id)
);

alter table public.estimates
  add column if not exists setting_set_id_used uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'estimates_setting_set_id_used_fkey'
      and conrelid = 'public.estimates'::regclass
  ) then
    alter table public.estimates
      add constraint estimates_setting_set_id_used_fkey
      foreign key (setting_set_id_used)
      references public.estimator_setting_set(id)
      on delete set null
      not valid;
  end if;
end $$;

create table if not exists public.estimator_setting_value (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  setting_set_id uuid not null,
  category_key text not null,
  row_id text null,
  scalar_key text null,
  display_name text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  value_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint estimator_setting_value_setting_set_fkey
    foreign key (setting_set_id)
    references public.estimator_setting_set(id)
    on delete cascade,
  constraint estimator_setting_value_key_check
    check (
      (row_id is not null and scalar_key is null)
      or (row_id is null and scalar_key is not null)
    )
);

create table if not exists public.setting_change_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  previous_setting_set_id uuid null,
  new_setting_set_id uuid null,
  target_key text not null,
  old_value_json jsonb null,
  new_value_json jsonb null,
  source text not null default 'manual',
  reason text not null default '',
  actor_id uuid null,
  recommendation_id uuid null,
  created_at timestamptz not null default now(),
  constraint setting_change_log_previous_set_fkey
    foreign key (previous_setting_set_id)
    references public.estimator_setting_set(id)
    on delete set null,
  constraint setting_change_log_new_set_fkey
    foreign key (new_setting_set_id)
    references public.estimator_setting_set(id)
    on delete set null
);

create unique index if not exists estimator_setting_set_one_active_per_org_idx
  on public.estimator_setting_set (org_id)
  where status = 'active';

create index if not exists estimator_setting_set_org_status_version_idx
  on public.estimator_setting_set (org_id, status, version_number desc);

create unique index if not exists estimator_setting_value_set_category_key_idx
  on public.estimator_setting_value (
    setting_set_id,
    category_key,
    coalesce(row_id, scalar_key)
  );

create index if not exists estimator_setting_value_org_set_category_sort_idx
  on public.estimator_setting_value (org_id, setting_set_id, category_key, sort_order, created_at);

create index if not exists estimates_setting_set_id_used_idx
  on public.estimates (org_id, setting_set_id_used)
  where setting_set_id_used is not null;

create index if not exists setting_change_log_org_created_idx
  on public.setting_change_log (org_id, created_at desc);

create index if not exists setting_change_log_new_set_idx
  on public.setting_change_log (org_id, new_setting_set_id)
  where new_setting_set_id is not null;

alter table public.estimator_setting_set enable row level security;
alter table public.estimator_setting_value enable row level security;
alter table public.setting_change_log enable row level security;

drop trigger if exists trg_estimator_setting_set_set_updated_at on public.estimator_setting_set;
create trigger trg_estimator_setting_set_set_updated_at
before update on public.estimator_setting_set
for each row
execute function public.set_updated_at();

drop trigger if exists trg_estimator_setting_value_set_updated_at on public.estimator_setting_value;
create trigger trg_estimator_setting_value_set_updated_at
before update on public.estimator_setting_value
for each row
execute function public.set_updated_at();

do $$
declare
  t text;
begin
  foreach t in array array[
    'estimator_setting_set',
    'estimator_setting_value',
    'setting_change_log'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (
        exists (
          select 1
          from public.org_members m
          where m.user_id = auth.uid()
            and m.org_id = %I.org_id
        )
      )',
      t || '_select',
      t,
      t
    );

    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (
        exists (
          select 1
          from public.org_members m
          where m.user_id = auth.uid()
            and m.org_id = %I.org_id
        )
      )',
      t || '_insert',
      t,
      t
    );

    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (
        exists (
          select 1
          from public.org_members m
          where m.user_id = auth.uid()
            and m.org_id = %I.org_id
        )
      )
      with check (
        exists (
          select 1
          from public.org_members m
          where m.user_id = auth.uid()
            and m.org_id = %I.org_id
        )
      )',
      t || '_update',
      t,
      t,
      t
    );

    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (
        exists (
          select 1
          from public.org_members m
          where m.user_id = auth.uid()
            and m.org_id = %I.org_id
        )
      )',
      t || '_delete',
      t,
      t
    );
  end loop;
end $$;

with setting_orgs as (
  select org_id
  from public.estimate_template_settings
  union
  select org_id
  from public.estimator_template_constants
),
next_versions as (
  select
    setting_orgs.org_id,
    coalesce(max(existing.version_number), 0) + 1 as version_number
  from setting_orgs
  left join public.estimator_setting_set existing
    on existing.org_id = setting_orgs.org_id
  where not exists (
    select 1
    from public.estimator_setting_set active_set
    where active_set.org_id = setting_orgs.org_id
      and active_set.status = 'active'
  )
  group by setting_orgs.org_id
)
insert into public.estimator_setting_set (
  org_id,
  version_number,
  status,
  activated_at,
  notes
)
select
  org_id,
  version_number,
  'active',
  now(),
  'Backfilled from current estimator settings'
from next_versions;

with active_sets as (
  select distinct on (org_id)
    id,
    org_id
  from public.estimator_setting_set
  where status = 'active'
  order by org_id, version_number desc, created_at desc
),
scalar_values as (
  select
    active_sets.id as setting_set_id,
    settings.org_id,
    'scalar_defaults'::text as category_key,
    scalar.key as scalar_key,
    initcap(replace(scalar.key, '_', ' ')) as display_name,
    row_number() over (partition by settings.org_id order by scalar.key)::integer as sort_order,
    jsonb_build_object('value', scalar.value) as value_json
  from public.estimate_template_settings settings
  join active_sets
    on active_sets.org_id = settings.org_id
  cross join lateral jsonb_each(to_jsonb(settings) - 'org_id' - 'updated_at') as scalar(key, value)
)
insert into public.estimator_setting_value (
  org_id,
  setting_set_id,
  category_key,
  scalar_key,
  display_name,
  active,
  sort_order,
  value_json
)
select
  org_id,
  setting_set_id,
  category_key,
  scalar_key,
  display_name,
  true,
  sort_order,
  value_json
from scalar_values sv
where not exists (
  select 1
  from public.estimator_setting_value existing
  where existing.setting_set_id = sv.setting_set_id
    and existing.category_key = sv.category_key
    and existing.scalar_key = sv.scalar_key
);

with active_sets as (
  select distinct on (org_id)
    id,
    org_id
  from public.estimator_setting_set
  where status = 'active'
  order by org_id, version_number desc, created_at desc
),
row_values as (
  select
    active_sets.id as setting_set_id,
    rows.org_id,
    rows.category_key,
    rows.row_id,
    rows.display_name,
    rows.active = 'Y' as active,
    rows.sort_order,
    rows.values_json as value_json
  from public.estimator_template_constant_rows rows
  join active_sets
    on active_sets.org_id = rows.org_id
)
insert into public.estimator_setting_value (
  org_id,
  setting_set_id,
  category_key,
  row_id,
  display_name,
  active,
  sort_order,
  value_json
)
select
  org_id,
  setting_set_id,
  category_key,
  row_id,
  display_name,
  active,
  sort_order,
  value_json
from row_values rv
where not exists (
  select 1
  from public.estimator_setting_value existing
  where existing.setting_set_id = rv.setting_set_id
    and existing.category_key = rv.category_key
    and existing.row_id = rv.row_id
);

with active_sets as (
  select distinct on (org_id)
    id,
    org_id
  from public.estimator_setting_set
  where status = 'active'
  order by org_id, version_number desc, created_at desc
)
update public.estimates estimates
set setting_set_id_used = active_sets.id
from active_sets
where estimates.org_id = active_sets.org_id
  and estimates.setting_set_id_used is null;
