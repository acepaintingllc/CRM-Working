-- Migrate legacy estimate_rooms scope inputs into Estimator V2 child scope rows.
--
-- This migration is intentionally additive:
-- - legacy estimate_rooms columns are preserved
-- - existing active V2 scope rows are not rewritten
-- - drywall is audited only because legacy rooms do not carry enough structured
--   repair data to create estimate_drywall_repairs safely

create temporary table if not exists legacy_estimate_room_scope_migration_audit (
  audit_phase text not null,
  audit_key text not null,
  estimate_count bigint not null,
  room_count bigint not null
) on commit drop;

create temporary table if not exists legacy_migrated_wall_scope_ids (
  id uuid primary key
) on commit drop;

create temporary table if not exists legacy_migrated_ceiling_scope_ids (
  id uuid primary key
) on commit drop;

truncate table legacy_estimate_room_scope_migration_audit;
truncate table legacy_migrated_wall_scope_ids;
truncate table legacy_migrated_ceiling_scope_ids;

with legacy_rooms as (
  select r.*
  from public.estimate_rooms r
  where r.room_id is not null
    and btrim(r.room_id) <> ''
),
audit as (
  select
    'before'::text as audit_phase,
    'all_scope_candidates'::text as audit_key,
    count(distinct (r.org_id, r.estimate_id))::bigint as estimate_count,
    count(*)::bigint as room_count
  from legacy_rooms r
  where not exists (
      select 1
      from public.estimate_room_wall_scopes s
      where s.org_id = r.org_id
        and s.estimate_id = r.estimate_id
        and s.active = 'Y'
    )
    and not exists (
      select 1
      from public.estimate_segments s
      where s.org_id = r.org_id
        and s.estimate_id = r.estimate_id
        and s.active = 'Y'
        and s.wall_scope_id is not null
    )
    and not exists (
      select 1
      from public.estimate_room_ceiling_scopes s
      where s.org_id = r.org_id
        and s.estimate_id = r.estimate_id
        and s.active = 'Y'
    )
    and not exists (
      select 1
      from public.estimate_room_ceiling_scope_segments s
      where s.org_id = r.org_id
        and s.estimate_id = r.estimate_id
        and s.active = 'Y'
    )
    and not exists (
      select 1
      from public.estimate_room_trim_scopes s
      where s.org_id = r.org_id
        and s.estimate_id = r.estimate_id
        and s.active = 'Y'
    )
    and not exists (
      select 1
      from public.estimate_room_door_scopes s
      where s.org_id = r.org_id
        and s.estimate_id = r.estimate_id
        and s.active = 'Y'
    )
    and not exists (
      select 1
      from public.estimate_drywall_repairs s
      where s.org_id = r.org_id
        and s.estimate_id = r.estimate_id
        and s.active = 'Y'
    )
  union all
  select
    'before'::text as audit_phase,
    'wall_candidates'::text as audit_key,
    count(distinct (r.org_id, r.estimate_id))::bigint as estimate_count,
    count(*)::bigint as room_count
  from legacy_rooms r
  where r.walls_include = 'Y'
    and not exists (
      select 1
      from public.estimate_room_wall_scopes s
      where s.org_id = r.org_id
        and s.estimate_id = r.estimate_id
        and s.active = 'Y'
    )
  union all
  select
    'before',
    'ceiling_candidates',
    count(distinct (r.org_id, r.estimate_id))::bigint,
    count(*)::bigint
  from legacy_rooms r
  where r.ceiling_include = 'Y'
    and not exists (
      select 1
      from public.estimate_room_ceiling_scopes s
      where s.org_id = r.org_id
        and s.estimate_id = r.estimate_id
        and s.active = 'Y'
    )
  union all
  select
    'before',
    'trim_candidates',
    count(distinct (r.org_id, r.estimate_id))::bigint,
    count(*)::bigint
  from legacy_rooms r
  where r.trim_include = 'Y'
    and not exists (
      select 1
      from public.estimate_room_trim_scopes s
      where s.org_id = r.org_id
        and s.estimate_id = r.estimate_id
        and s.active = 'Y'
    )
  union all
  select
    'before',
    'door_candidates',
    count(distinct (r.org_id, r.estimate_id))::bigint,
    count(*)::bigint
  from legacy_rooms r
  where (r.doors_include = 'Y' or r.paint_doors = 'Y')
    and not exists (
      select 1
      from public.estimate_room_door_scopes s
      where s.org_id = r.org_id
        and s.estimate_id = r.estimate_id
        and s.active = 'Y'
    )
  union all
  select
    'before',
    'drywall_todo_candidates',
    count(distinct (r.org_id, r.estimate_id))::bigint,
    count(*)::bigint
  from legacy_rooms r
  where r.drywall_include = 'Y'
    and not exists (
      select 1
      from public.estimate_drywall_repairs s
      where s.org_id = r.org_id
        and s.estimate_id = r.estimate_id
        and s.active = 'Y'
    )
)
insert into legacy_estimate_room_scope_migration_audit (
  audit_phase,
  audit_key,
  estimate_count,
  room_count
)
select audit_phase, audit_key, estimate_count, room_count
from audit;

with wall_candidates as (
  select
    r.*,
    js.walls_paint_id,
    coalesce(js.walls_primer_id, js.primer_id) as walls_primer_product_id
  from public.estimate_rooms r
  left join public.estimate_jobsettings js
    on js.org_id = r.org_id
   and js.estimate_id = r.estimate_id
  where r.room_id is not null
    and btrim(r.room_id) <> ''
    and r.walls_include = 'Y'
    and not exists (
      select 1
      from public.estimate_room_wall_scopes s
      where s.org_id = r.org_id
        and s.estimate_id = r.estimate_id
        and s.active = 'Y'
    )
    and not exists (
      select 1
      from public.estimate_room_wall_scopes s
      where s.org_id = r.org_id
        and s.estimate_id = r.estimate_id
        and s.room_id = r.room_id
        and s.position = r.position
        and s.active = 'Y'
    )
),
inserted_wall_scopes as (
  insert into public.estimate_room_wall_scopes (
  org_id,
  estimate_id,
  job_id,
  room_id,
  position,
  mode,
  include,
  scope_name,
  color_id,
  paint_product_id,
  primer_product_id,
  prime_mode,
  height_in,
  perimeter_in,
  standard_door_count,
  standard_window_count,
  override_area_sf,
  notes,
  paint_coats,
  primer_coats,
  spot_prime_percent,
  condition_selections,
    active
  )
  select
    r.org_id,
    r.estimate_id,
    r.job_id,
    r.room_id,
    r.position,
    case when r.mode = 'SEG' then 'SEG' else 'RECT' end,
    'Y',
    nullif(r.room_name, ''),
    nullif(r.wall_color_id, ''),
    nullif(r.walls_paint_id, ''),
    nullif(r.walls_primer_product_id, ''),
    case
      when upper(btrim(coalesce(r.walls_primer, ''))) in ('FULL', 'SPOT', 'NONE') then upper(btrim(r.walls_primer))
      when upper(btrim(coalesce(r.walls_primer, ''))) in ('Y', 'YES', 'TRUE', '1') then 'FULL'
      else 'NONE'
    end,
    r.wallheight_in,
    case
      when r.length_in is not null and r.width_in is not null then (r.length_in + r.width_in) * 2
      else null
    end,
    r.door_count,
    r.window_count,
    r.wall_sqft_override,
    coalesce(nullif(r.walls_notes, ''), nullif(r.notes, '')),
    r.walls_topcoats,
    r.wall_primer_coats,
    r.wall_spot_prime_pct,
    r.condition_selections,
    'Y'
  from wall_candidates r
  returning id
)
insert into legacy_migrated_wall_scope_ids (id)
select id
from inserted_wall_scopes
on conflict (id) do nothing;

update public.estimate_segments s
set
  wall_scope_id = w.id,
  updated_at = now()
from public.estimate_room_wall_scopes w
join legacy_migrated_wall_scope_ids migrated
  on migrated.id = w.id
join public.estimate_rooms r
  on r.org_id = w.org_id
 and r.estimate_id = w.estimate_id
 and r.room_id = w.room_id
where s.org_id = w.org_id
  and s.estimate_id = w.estimate_id
  and s.room_id = w.room_id
  and s.active = 'Y'
  and s.wall_scope_id is null
  and w.active = 'Y'
  and w.mode = 'SEG'
  and r.mode = 'SEG'
  and r.walls_include = 'Y';

with ceiling_candidates as (
  select
    r.*,
    js.ceiling_paint_id,
    coalesce(js.ceiling_primer_id, js.primer_id) as ceiling_primer_product_id,
    exists (
      select 1
      from public.estimate_ceiling_segments cs
      where cs.org_id = r.org_id
        and cs.estimate_id = r.estimate_id
        and cs.room_id = r.room_id
        and cs.active = 'Y'
    ) as has_legacy_segments
  from public.estimate_rooms r
  left join public.estimate_jobsettings js
    on js.org_id = r.org_id
   and js.estimate_id = r.estimate_id
  where r.room_id is not null
    and btrim(r.room_id) <> ''
    and r.ceiling_include = 'Y'
    and not exists (
      select 1
      from public.estimate_room_ceiling_scopes s
      where s.org_id = r.org_id
        and s.estimate_id = r.estimate_id
        and s.active = 'Y'
    )
    and not exists (
      select 1
      from public.estimate_room_ceiling_scopes s
      where s.org_id = r.org_id
        and s.estimate_id = r.estimate_id
        and s.room_id = r.room_id
        and s.position = r.position
        and s.active = 'Y'
    )
),
inserted_ceiling_scopes as (
  insert into public.estimate_room_ceiling_scopes (
  org_id,
  estimate_id,
  job_id,
  room_id,
  position,
  mode,
  include,
  scope_name,
  paint_product_id,
  primer_product_id,
  prime_mode,
  ceiling_type_id,
  ceiling_geometry_mode,
  length_in,
  width_in,
  area_sf,
  override_area_sf,
  paint_coats,
  notes,
  condition_selections,
    active
  )
  select
    r.org_id,
    r.estimate_id,
    r.job_id,
    r.room_id,
    r.position,
    case when r.has_legacy_segments then 'SEG' else 'RECT' end,
    'Y',
    nullif(r.room_name, ''),
    nullif(r.ceiling_paint_id, ''),
    nullif(r.ceiling_primer_product_id, ''),
    case
      when upper(btrim(coalesce(r.ceiling_primer, ''))) in ('FULL', 'SPOT', 'NONE') then upper(btrim(r.ceiling_primer))
      when upper(btrim(coalesce(r.ceiling_primer, ''))) in ('Y', 'YES', 'TRUE', '1') then 'FULL'
      else 'NONE'
    end,
    nullif(r.ceiling_type_id, ''),
    case when r.ceilingsqft_override is not null then 'MANUAL' else 'FLAT' end,
    r.length_in,
    r.width_in,
    r.ceilingsqft_override,
    r.ceilingsqft_override,
    r.ceiling_topcoats,
    coalesce(nullif(r.ceiling_prep_level, ''), nullif(r.ceiling_prep_override, ''), nullif(r.notes, '')),
    r.condition_selections,
    'Y'
  from ceiling_candidates r
  returning id
)
insert into legacy_migrated_ceiling_scope_ids (id)
select id
from inserted_ceiling_scopes
on conflict (id) do nothing;

insert into public.estimate_room_ceiling_scope_segments (
  id,
  org_id,
  estimate_id,
  job_id,
  ceiling_scope_id,
  room_id,
  position,
  segment_name,
  include,
  shape_type,
  quantity,
  width_in,
  height_in,
  notes,
  active
)
select
  cs.id,
  cs.org_id,
  cs.estimate_id,
  cs.job_id,
  scope.id,
  cs.room_id,
  cs.position,
  case when cs.seg_no is not null then 'Ceiling segment ' || cs.seg_no::text else null end,
  'Y',
  'RECTANGLE',
  1,
  cs.length_in,
  cs.width_in,
  cs.notes,
  cs.active
from public.estimate_ceiling_segments cs
join public.estimate_room_ceiling_scopes scope
  on scope.org_id = cs.org_id
 and scope.estimate_id = cs.estimate_id
 and scope.room_id = cs.room_id
 and scope.active = 'Y'
join legacy_migrated_ceiling_scope_ids migrated
  on migrated.id = scope.id
where cs.active = 'Y'
  and scope.mode = 'SEG'
  and not exists (
    select 1
    from public.estimate_room_ceiling_scope_segments existing
    where existing.id = cs.id
       or (
        existing.org_id = cs.org_id
        and existing.estimate_id = cs.estimate_id
        and existing.ceiling_scope_id = scope.id
        and existing.room_id = cs.room_id
        and existing.position = cs.position
        and existing.active = 'Y'
      )
  )
on conflict (id) do nothing;

with trim_source as (
  select
    r.*,
    js.trim_paint_id,
    coalesce(js.trim_primer_id, js.primer_id) as trim_primer_product_id,
    case
      when r.length_in is not null and r.width_in is not null then (r.length_in + r.width_in) * 2
      else null
    end as room_perimeter_in
  from public.estimate_rooms r
  left join public.estimate_jobsettings js
    on js.org_id = r.org_id
   and js.estimate_id = r.estimate_id
  where r.room_id is not null
    and btrim(r.room_id) <> ''
    and r.trim_include = 'Y'
    and not exists (
      select 1
      from public.estimate_room_trim_scopes s
      where s.org_id = r.org_id
        and s.estimate_id = r.estimate_id
        and s.active = 'Y'
    )
),
trim_candidates as (
  select
    *,
    0 as scope_offset,
    'Baseboard'::text as scope_name,
    nullif(baseboard_type_id, '') as trim_type_id,
    'base'::text as trim_family,
    'LF'::text as unit_type,
    case when baseboard_auto = 'Y' and room_perimeter_in is not null then 'ROOM_HELPER' else 'MANUAL' end as measurement_mode,
    case when baseboard_auto = 'Y' and room_perimeter_in is not null then 'ROOM_PERIMETER' else null end as helper_source,
    baseboard_lf as measurement_value,
    case when baseboard_auto = 'Y' and room_perimeter_in is not null then room_perimeter_in / 12 else null end as helper_value,
    case when paint_base = 'N' then 'N' else 'Y' end as paint_enabled,
    (coalesce(door_count, 0) + coalesce(window_count, 0)) as baseboard_opening_count
  from trim_source
  where nullif(baseboard_type_id, '') is not null
     or baseboard_lf is not null
     or paint_base = 'Y'
  union all
  select
    *,
    1,
    'Crown',
    nullif(crown_type_id, ''),
    'crown',
    'LF',
    case when crown_auto = 'Y' and room_perimeter_in is not null then 'ROOM_HELPER' else 'MANUAL' end,
    case when crown_auto = 'Y' and room_perimeter_in is not null then 'ROOM_PERIMETER' else null end,
    crown_lf,
    case when crown_auto = 'Y' and room_perimeter_in is not null then room_perimeter_in / 12 else null end,
    case when paint_crown = 'N' then 'N' else 'Y' end,
    null::numeric
  from trim_source
  where nullif(crown_type_id, '') is not null
     or crown_lf is not null
     or paint_crown = 'Y'
  union all
  select
    *,
    2,
    'Window casing',
    nullif(window_casing_type_id, ''),
    'door_window',
    'EA',
    'MANUAL',
    null,
    window_count,
    null::numeric,
    case when paint_window_casing = 'N' then 'N' else 'Y' end,
    null::numeric
  from trim_source
  where nullif(window_casing_type_id, '') is not null
     or window_count is not null
     or paint_window_casing = 'Y'
  union all
  select
    *,
    3,
    'Door casing',
    nullif(door_casing_type_id, ''),
    'door_window',
    'EA',
    'MANUAL',
    null,
    door_casing_count,
    null::numeric,
    case when paint_door_casing = 'N' then 'N' else 'Y' end,
    null::numeric
  from trim_source
  where nullif(door_casing_type_id, '') is not null
     or door_casing_count is not null
     or paint_door_casing = 'Y'
)
insert into public.estimate_room_trim_scopes (
  org_id,
  estimate_id,
  job_id,
  room_id,
  position,
  include,
  scope_name,
  trim_type_id,
  trim_family,
  unit_type,
  measurement_mode,
  helper_source,
  measurement_value,
  helper_value,
  paint_product_id,
  primer_product_id,
  paint_enabled,
  prime_mode,
  paint_coats,
  notes,
  condition_selections,
  baseboard_opening_count,
  active
)
select
  r.org_id,
  r.estimate_id,
  r.job_id,
  r.room_id,
  (r.position * 10) + r.scope_offset,
  'Y',
  r.scope_name,
  r.trim_type_id,
  r.trim_family,
  r.unit_type,
  r.measurement_mode,
  r.helper_source,
  r.measurement_value,
  r.helper_value,
  nullif(r.trim_paint_id, ''),
  nullif(r.trim_primer_product_id, ''),
  r.paint_enabled,
  case
    when upper(btrim(coalesce(r.trim_primer, ''))) in ('FULL', 'SPOT', 'NONE') then upper(btrim(r.trim_primer))
    when upper(btrim(coalesce(r.trim_primer, ''))) in ('Y', 'YES', 'TRUE', '1') then 'FULL'
    else 'NONE'
  end,
  r.trim_topcoats,
  coalesce(nullif(r.trim_prep_override, ''), nullif(r.notes, '')),
  r.condition_selections,
  r.baseboard_opening_count,
  'Y'
from trim_candidates r
where not exists (
  select 1
  from public.estimate_room_trim_scopes existing
  where existing.org_id = r.org_id
    and existing.estimate_id = r.estimate_id
    and existing.room_id = r.room_id
    and existing.position = (r.position * 10) + r.scope_offset
    and existing.active = 'Y'
);

with door_candidates as (
  select
    r.*,
    js.trim_paint_id,
    coalesce(js.trim_primer_id, js.primer_id) as door_primer_product_id
  from public.estimate_rooms r
  left join public.estimate_jobsettings js
    on js.org_id = r.org_id
   and js.estimate_id = r.estimate_id
  where r.room_id is not null
    and btrim(r.room_id) <> ''
    and (r.doors_include = 'Y' or r.paint_doors = 'Y')
    and not exists (
      select 1
      from public.estimate_room_door_scopes s
      where s.org_id = r.org_id
        and s.estimate_id = r.estimate_id
        and s.active = 'Y'
    )
    and not exists (
      select 1
      from public.estimate_room_door_scopes s
      where s.org_id = r.org_id
        and s.estimate_id = r.estimate_id
        and s.room_id = r.room_id
        and s.position = r.position
        and s.active = 'Y'
    )
)
insert into public.estimate_room_door_scopes (
  org_id,
  estimate_id,
  job_id,
  room_id,
  position,
  include,
  scope_name,
  door_type_id,
  paint_product_id,
  primer_product_id,
  prime_mode,
  quantity,
  sides,
  paint_coats,
  notes,
  active
)
select
  r.org_id,
  r.estimate_id,
  r.job_id,
  r.room_id,
  r.position,
  'Y',
  nullif(r.room_name, ''),
  nullif(r.door_type_id, ''),
  nullif(r.trim_paint_id, ''),
  nullif(r.door_primer_product_id, ''),
  case
    when upper(btrim(coalesce(r.trim_primer, ''))) in ('FULL', 'SPOT', 'NONE') then upper(btrim(r.trim_primer))
    when upper(btrim(coalesce(r.trim_primer, ''))) in ('Y', 'YES', 'TRUE', '1') then 'FULL'
    else 'NONE'
  end,
  coalesce(r.door_paint_count, r.door_count),
  r.door_sides,
  r.trim_topcoats,
  coalesce(nullif(r.doors_prep_override, ''), nullif(r.notes, '')),
  'Y'
from door_candidates r;

-- TODO(drywall migration): legacy estimate_rooms only exposes drywall_include,
-- with no surface, repair_type, unit, or quantity. Those rows remain auditable
-- legacy candidates and should be converted only after a structured repair
-- source or explicit business rule exists.

with legacy_rooms as (
  select r.*
  from public.estimate_rooms r
  where r.room_id is not null
    and btrim(r.room_id) <> ''
),
audit as (
  select
    'after'::text as audit_phase,
    'all_scope_candidates'::text as audit_key,
    count(distinct (r.org_id, r.estimate_id))::bigint as estimate_count,
    count(*)::bigint as room_count
  from legacy_rooms r
  where not exists (
      select 1
      from public.estimate_room_wall_scopes s
      where s.org_id = r.org_id
        and s.estimate_id = r.estimate_id
        and s.active = 'Y'
    )
    and not exists (
      select 1
      from public.estimate_segments s
      where s.org_id = r.org_id
        and s.estimate_id = r.estimate_id
        and s.active = 'Y'
        and s.wall_scope_id is not null
    )
    and not exists (
      select 1
      from public.estimate_room_ceiling_scopes s
      where s.org_id = r.org_id
        and s.estimate_id = r.estimate_id
        and s.active = 'Y'
    )
    and not exists (
      select 1
      from public.estimate_room_ceiling_scope_segments s
      where s.org_id = r.org_id
        and s.estimate_id = r.estimate_id
        and s.active = 'Y'
    )
    and not exists (
      select 1
      from public.estimate_room_trim_scopes s
      where s.org_id = r.org_id
        and s.estimate_id = r.estimate_id
        and s.active = 'Y'
    )
    and not exists (
      select 1
      from public.estimate_room_door_scopes s
      where s.org_id = r.org_id
        and s.estimate_id = r.estimate_id
        and s.active = 'Y'
    )
    and not exists (
      select 1
      from public.estimate_drywall_repairs s
      where s.org_id = r.org_id
        and s.estimate_id = r.estimate_id
        and s.active = 'Y'
    )
  union all
  select
    'after'::text as audit_phase,
    'wall_candidates'::text as audit_key,
    count(distinct (r.org_id, r.estimate_id))::bigint as estimate_count,
    count(*)::bigint as room_count
  from legacy_rooms r
  where r.walls_include = 'Y'
    and not exists (
      select 1
      from public.estimate_room_wall_scopes s
      where s.org_id = r.org_id
        and s.estimate_id = r.estimate_id
        and s.active = 'Y'
    )
  union all
  select
    'after',
    'ceiling_candidates',
    count(distinct (r.org_id, r.estimate_id))::bigint,
    count(*)::bigint
  from legacy_rooms r
  where r.ceiling_include = 'Y'
    and not exists (
      select 1
      from public.estimate_room_ceiling_scopes s
      where s.org_id = r.org_id
        and s.estimate_id = r.estimate_id
        and s.active = 'Y'
    )
  union all
  select
    'after',
    'trim_candidates',
    count(distinct (r.org_id, r.estimate_id))::bigint,
    count(*)::bigint
  from legacy_rooms r
  where r.trim_include = 'Y'
    and not exists (
      select 1
      from public.estimate_room_trim_scopes s
      where s.org_id = r.org_id
        and s.estimate_id = r.estimate_id
        and s.active = 'Y'
    )
  union all
  select
    'after',
    'door_candidates',
    count(distinct (r.org_id, r.estimate_id))::bigint,
    count(*)::bigint
  from legacy_rooms r
  where (r.doors_include = 'Y' or r.paint_doors = 'Y')
    and not exists (
      select 1
      from public.estimate_room_door_scopes s
      where s.org_id = r.org_id
        and s.estimate_id = r.estimate_id
        and s.active = 'Y'
    )
  union all
  select
    'after',
    'drywall_todo_candidates',
    count(distinct (r.org_id, r.estimate_id))::bigint,
    count(*)::bigint
  from legacy_rooms r
  where r.drywall_include = 'Y'
    and not exists (
      select 1
      from public.estimate_drywall_repairs s
      where s.org_id = r.org_id
        and s.estimate_id = r.estimate_id
        and s.active = 'Y'
    )
)
insert into legacy_estimate_room_scope_migration_audit (
  audit_phase,
  audit_key,
  estimate_count,
  room_count
)
select audit_phase, audit_key, estimate_count, room_count
from audit;

select
  audit_phase,
  audit_key,
  estimate_count,
  room_count
from legacy_estimate_room_scope_migration_audit
order by
  case audit_phase when 'before' then 0 when 'after' then 1 else 2 end,
  audit_key;

-- Final verification query:
-- Manual Supabase verification: after applying this migration to the target
-- database, run this query and confirm all_scope_candidates returns
-- estimate_count = 0 and room_count = 0 before deleting the migration branch.
-- with legacy_rooms as (
--   select r.*
--   from public.estimate_rooms r
--   where r.room_id is not null
--     and btrim(r.room_id) <> ''
-- )
-- select 'all_scope_candidates' as audit_key, count(distinct (r.org_id, r.estimate_id)) as estimate_count, count(*) as room_count
-- from legacy_rooms r
-- where not exists (
--     select 1 from public.estimate_room_wall_scopes s
--     where s.org_id = r.org_id and s.estimate_id = r.estimate_id and s.active = 'Y'
--   )
--   and not exists (
--     select 1 from public.estimate_segments s
--     where s.org_id = r.org_id and s.estimate_id = r.estimate_id and s.active = 'Y' and s.wall_scope_id is not null
--   )
--   and not exists (
--     select 1 from public.estimate_room_ceiling_scopes s
--     where s.org_id = r.org_id and s.estimate_id = r.estimate_id and s.active = 'Y'
--   )
--   and not exists (
--     select 1 from public.estimate_room_ceiling_scope_segments s
--     where s.org_id = r.org_id and s.estimate_id = r.estimate_id and s.active = 'Y'
--   )
--   and not exists (
--     select 1 from public.estimate_room_trim_scopes s
--     where s.org_id = r.org_id and s.estimate_id = r.estimate_id and s.active = 'Y'
--   )
--   and not exists (
--     select 1 from public.estimate_room_door_scopes s
--     where s.org_id = r.org_id and s.estimate_id = r.estimate_id and s.active = 'Y'
--   )
--   and not exists (
--     select 1 from public.estimate_drywall_repairs s
--     where s.org_id = r.org_id and s.estimate_id = r.estimate_id and s.active = 'Y'
--   )
-- union all
-- select 'wall_candidates' as audit_key, count(distinct (r.org_id, r.estimate_id)) as estimate_count, count(*) as room_count
-- from legacy_rooms r
-- where r.walls_include = 'Y'
--   and not exists (
--     select 1 from public.estimate_room_wall_scopes s
--     where s.org_id = r.org_id and s.estimate_id = r.estimate_id and s.active = 'Y'
--   )
-- union all
-- select 'ceiling_candidates', count(distinct (r.org_id, r.estimate_id)), count(*)
-- from legacy_rooms r
-- where r.ceiling_include = 'Y'
--   and not exists (
--     select 1 from public.estimate_room_ceiling_scopes s
--     where s.org_id = r.org_id and s.estimate_id = r.estimate_id and s.active = 'Y'
--   )
-- union all
-- select 'trim_candidates', count(distinct (r.org_id, r.estimate_id)), count(*)
-- from legacy_rooms r
-- where r.trim_include = 'Y'
--   and not exists (
--     select 1 from public.estimate_room_trim_scopes s
--     where s.org_id = r.org_id and s.estimate_id = r.estimate_id and s.active = 'Y'
--   )
-- union all
-- select 'door_candidates', count(distinct (r.org_id, r.estimate_id)), count(*)
-- from legacy_rooms r
-- where (r.doors_include = 'Y' or r.paint_doors = 'Y')
--   and not exists (
--     select 1 from public.estimate_room_door_scopes s
--     where s.org_id = r.org_id and s.estimate_id = r.estimate_id and s.active = 'Y'
--   )
-- union all
-- select 'drywall_todo_candidates', count(distinct (r.org_id, r.estimate_id)), count(*)
-- from legacy_rooms r
-- where r.drywall_include = 'Y'
--   and not exists (
--     select 1 from public.estimate_drywall_repairs s
--     where s.org_id = r.org_id and s.estimate_id = r.estimate_id and s.active = 'Y'
--   );
