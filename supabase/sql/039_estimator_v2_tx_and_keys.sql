-- Estimator v2 efficiency pass:
-- 1) transactional save function for v2 payloads
-- 2) natural-key constraints/indexes for active v2 row sets

-- Deduplicate active legacy segment keys before creating active-key uniqueness.
with ranked as (
  select
    id,
    row_number() over (
      partition by org_id, estimate_id, room_id, seg_no
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as rn
  from public.estimate_segments
  where active = 'Y'
    and room_id is not null
    and seg_no is not null
)
update public.estimate_segments s
set active = 'N'
from ranked
where s.id = ranked.id
  and ranked.rn > 1;

create unique index if not exists estimate_segments_active_room_seg_key
  on public.estimate_segments (org_id, estimate_id, room_id, seg_no)
  where active = 'Y' and room_id is not null and seg_no is not null;

create unique index if not exists estimate_job_colors_active_color_key
  on public.estimate_job_colors (org_id, estimate_id, color_id)
  where active = 'Y' and color_id is not null and btrim(color_id) <> '';

create unique index if not exists estimate_room_flags_active_flag_key
  on public.estimate_room_flags (org_id, estimate_id, room_id, flag_id)
  where active = 'Y'
    and room_id is not null and btrim(room_id) <> ''
    and flag_id is not null and btrim(flag_id) <> '';

create unique index if not exists estimate_access_fees_active_key
  on public.estimate_access_fees (org_id, estimate_id, room_id, coalesce(segment_num, -1), access_fee_id)
  where active = 'Y'
    and room_id is not null and btrim(room_id) <> ''
    and access_fee_id is not null and btrim(access_fee_id) <> '';

create or replace function public.save_estimate_v2_inputs(
  p_org_id uuid,
  p_estimate_id uuid,
  p_job_id uuid,
  p_payload jsonb
) returns void
language plpgsql
set search_path = public
as $$
begin
  if p_payload ? 'jobsettings' and jsonb_typeof(p_payload->'jobsettings') = 'object' then
    insert into public.estimate_jobsettings (
      org_id,
      estimate_id,
      job_id,
      walls_paint_id,
      primer_id,
      paint_supplied_by,
      crew_size,
      notes
    )
    select
      p_org_id,
      p_estimate_id,
      p_job_id,
      nullif(trim(p_payload->'jobsettings'->>'walls_paint_id'), ''),
      nullif(trim(p_payload->'jobsettings'->>'primer_id'), ''),
      nullif(trim(p_payload->'jobsettings'->>'paint_supplied_by'), ''),
      nullif(trim(p_payload->'jobsettings'->>'crew_size'), '')::numeric,
      nullif(trim(p_payload->'jobsettings'->>'notes'), '')
    on conflict (org_id, estimate_id)
    do update set
      walls_paint_id = excluded.walls_paint_id,
      primer_id = excluded.primer_id,
      paint_supplied_by = excluded.paint_supplied_by,
      crew_size = excluded.crew_size,
      notes = excluded.notes,
      updated_at = now();
  end if;

  if p_payload ? 'rooms' and jsonb_typeof(p_payload->'rooms') = 'array' then
    delete from public.estimate_rooms
    where org_id = p_org_id
      and estimate_id = p_estimate_id;

    insert into public.estimate_rooms (
      id,
      org_id,
      estimate_id,
      job_id,
      position,
      room_id,
      room_name,
      room_type_id,
      mode,
      length_in,
      width_in,
      wallheight_in,
      ceilingheight_in,
      door_count,
      window_count,
      wall_color_id,
      walls_include,
      walls_topcoats,
      walls_primer,
      wall_primer_coats,
      wall_spot_prime_pct,
      ceiling_include,
      trim_include,
      doors_include,
      drywall_include,
      paint_supplied_by,
      wall_complexity_id,
      notes,
      paint_doors
    )
    select
      case
        when (row->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then (row->>'id')::uuid
        else gen_random_uuid()
      end,
      p_org_id,
      p_estimate_id,
      p_job_id,
      coalesce(nullif(trim(row->>'position'), '')::int, row_number() over () - 1),
      upper(nullif(trim(row->>'room_id'), '')),
      trim(coalesce(row->>'room_name', '')),
      upper(nullif(trim(row->>'room_type_id'), '')),
      case when upper(trim(coalesce(row->>'mode', ''))) = 'SEG' then 'SEG' else 'RECT' end,
      nullif(trim(row->>'length_in'), '')::numeric,
      nullif(trim(row->>'width_in'), '')::numeric,
      nullif(trim(row->>'wallheight_in'), '')::numeric,
      nullif(trim(row->>'ceilingheight_in'), '')::numeric,
      nullif(trim(row->>'door_count'), '')::numeric,
      nullif(trim(row->>'window_count'), '')::numeric,
      upper(nullif(trim(row->>'wall_color_id'), '')),
      case when upper(trim(coalesce(row->>'walls_include', 'Y'))) = 'N' then 'N' else 'Y' end,
      nullif(trim(row->>'wall_coats'), '')::numeric,
      nullif(trim(row->>'wall_primer_mode'), ''),
      nullif(trim(row->>'wall_primer_coats'), '')::numeric,
      nullif(trim(row->>'wall_spot_prime_pct'), '')::numeric,
      case when upper(trim(coalesce(row->>'ceiling_include', 'N'))) = 'Y' then 'Y' else 'N' end,
      case when upper(trim(coalesce(row->>'trim_include', 'N'))) = 'Y' then 'Y' else 'N' end,
      case when upper(trim(coalesce(row->>'doors_include', 'N'))) = 'Y' then 'Y' else 'N' end,
      case when upper(trim(coalesce(row->>'drywall_include', 'N'))) = 'Y' then 'Y' else 'N' end,
      nullif(trim(row->>'paint_supplied_by'), ''),
      upper(nullif(trim(row->>'wall_complexity_id'), '')),
      nullif(trim(row->>'notes'), ''),
      case when upper(trim(coalesce(row->>'doors_include', 'N'))) = 'Y' then 'Y' else 'N' end
    from jsonb_array_elements(p_payload->'rooms') as row
    where trim(coalesce(row->>'room_name', '')) <> '';
  end if;

  if p_payload ? 'segments' and jsonb_typeof(p_payload->'segments') = 'array' then
    update public.estimate_segments
    set active = 'N'
    where org_id = p_org_id
      and estimate_id = p_estimate_id
      and active = 'Y';

    insert into public.estimate_segments (
      id,
      org_id,
      estimate_id,
      job_id,
      position,
      room_id,
      seg_no,
      seglen_in,
      seg_wallheight_in,
      wall_label,
      wall_color_override_id,
      walls_calc_method,
      active
    )
    select
      case
        when (row->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then (row->>'id')::uuid
        else gen_random_uuid()
      end,
      p_org_id,
      p_estimate_id,
      p_job_id,
      coalesce(nullif(trim(row->>'position'), '')::int, row_number() over () - 1),
      upper(nullif(trim(row->>'room_id'), '')),
      nullif(trim(row->>'seg_no'), '')::int,
      nullif(trim(row->>'seglen_in'), '')::numeric,
      nullif(trim(row->>'seg_wallheight_in'), '')::numeric,
      nullif(trim(row->>'wall_label'), ''),
      upper(nullif(trim(row->>'wall_color_override_id'), '')),
      'REGULAR',
      case when upper(trim(coalesce(row->>'active', 'Y'))) = 'N' then 'N' else 'Y' end
    from jsonb_array_elements(p_payload->'segments') as row
    where trim(coalesce(row->>'room_id', '')) <> ''
      and nullif(trim(row->>'seg_no'), '') is not null;
  end if;

  if p_payload ? 'job_colors' and jsonb_typeof(p_payload->'job_colors') = 'array' then
    update public.estimate_job_colors
    set active = 'N'
    where org_id = p_org_id
      and estimate_id = p_estimate_id
      and active = 'Y';

    insert into public.estimate_job_colors (
      id,
      org_id,
      estimate_id,
      job_id,
      position,
      color_id,
      color_name,
      roller_cover_id,
      roller_cover_qty,
      active
    )
    select
      case
        when (row->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then (row->>'id')::uuid
        else gen_random_uuid()
      end,
      p_org_id,
      p_estimate_id,
      p_job_id,
      coalesce(nullif(trim(row->>'position'), '')::int, row_number() over () - 1),
      upper(nullif(trim(row->>'color_id'), '')),
      nullif(trim(row->>'color_name'), ''),
      upper(nullif(trim(row->>'roller_cover_id'), '')),
      nullif(trim(row->>'roller_cover_qty'), '')::numeric,
      case when upper(trim(coalesce(row->>'active', 'Y'))) = 'N' then 'N' else 'Y' end
    from jsonb_array_elements(p_payload->'job_colors') as row
    where trim(coalesce(row->>'color_id', '')) <> '';
  end if;

  if p_payload ? 'room_flags' and jsonb_typeof(p_payload->'room_flags') = 'array' then
    update public.estimate_room_flags
    set active = 'N'
    where org_id = p_org_id
      and estimate_id = p_estimate_id
      and active = 'Y';

    insert into public.estimate_room_flags (
      id,
      org_id,
      estimate_id,
      job_id,
      position,
      room_id,
      flag_id,
      active
    )
    select
      case
        when (row->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then (row->>'id')::uuid
        else gen_random_uuid()
      end,
      p_org_id,
      p_estimate_id,
      p_job_id,
      coalesce(nullif(trim(row->>'position'), '')::int, row_number() over () - 1),
      upper(nullif(trim(row->>'room_id'), '')),
      upper(nullif(trim(row->>'flag_id'), '')),
      case when upper(trim(coalesce(row->>'active', 'Y'))) = 'N' then 'N' else 'Y' end
    from jsonb_array_elements(p_payload->'room_flags') as row
    where trim(coalesce(row->>'room_id', '')) <> ''
      and trim(coalesce(row->>'flag_id', '')) <> '';
  end if;

  if p_payload ? 'access_fees' and jsonb_typeof(p_payload->'access_fees') = 'array' then
    update public.estimate_access_fees
    set active = 'N'
    where org_id = p_org_id
      and estimate_id = p_estimate_id
      and active = 'Y';

    insert into public.estimate_access_fees (
      id,
      org_id,
      estimate_id,
      job_id,
      position,
      room_id,
      segment_num,
      access_fee_id,
      qty,
      active,
      notes,
      actual_cost_override
    )
    select
      case
        when (row->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then (row->>'id')::uuid
        else gen_random_uuid()
      end,
      p_org_id,
      p_estimate_id,
      p_job_id,
      coalesce(nullif(trim(row->>'position'), '')::int, row_number() over () - 1),
      upper(nullif(trim(row->>'room_id'), '')),
      nullif(trim(row->>'segment_num'), '')::numeric,
      upper(nullif(trim(row->>'access_fee_id'), '')),
      coalesce(nullif(trim(row->>'qty'), '')::numeric, 1),
      case when upper(trim(coalesce(row->>'active', 'Y'))) = 'N' then 'N' else 'Y' end,
      nullif(trim(row->>'notes'), ''),
      nullif(trim(row->>'actual_cost_override'), '')::numeric
    from jsonb_array_elements(p_payload->'access_fees') as row
    where trim(coalesce(row->>'room_id', '')) <> ''
      and trim(coalesce(row->>'access_fee_id', '')) <> '';
  end if;
end;
$$;
