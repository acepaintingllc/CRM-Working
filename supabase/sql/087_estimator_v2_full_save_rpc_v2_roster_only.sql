-- Full Estimator V2 persistence RPC. Room persistence is V2 roster-only.
-- Accepts already-normalized persistence rows from TypeScript and commits the
-- complete save atomically, including the final estimates.updated_at touch.

alter table public.estimate_jobsettings
  add column if not exists trim_paint_gallons numeric,
  add column if not exists trim_paint_quarts numeric,
  add column if not exists trim_paint_qty numeric,
  add column if not exists trim_paint_uom text;

alter table public.estimate_access_fees
  alter column room_id drop not null;

create or replace function public.save_estimate_v2_full_persistence(
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
      ceiling_paint_id,
      trim_paint_id,
      primer_id,
      walls_primer_id,
      ceiling_primer_id,
      trim_primer_id,
      override_labor_rate,
      override_markup,
      rounding_increment_hours,
      dayhours,
      default_walls_prep_level,
      default_ceiling_prep_level,
      default_trim_prep_level,
      notes,
      walls_paint_gal_override,
      ceiling_paint_gal_override,
      primer_gal_override,
      extra_supplies_walls,
      extra_supplies_ceilings,
      extra_supplies_trim,
      trim_paint_gallons,
      trim_paint_quarts,
      trim_paint_qty,
      trim_paint_uom,
      trim_primer_qty,
      trim_primer_uom,
      paint_supplied_by,
      crew_size,
      standard_door_deduction_sf,
      standard_window_deduction_sf,
      baseboard_opening_deduction_lf,
      labor_day_policy_enabled,
      job_minimum_enabled,
      job_minimum_amount
    )
    select
      p_org_id,
      p_estimate_id,
      p_job_id,
      row.walls_paint_id,
      row.ceiling_paint_id,
      row.trim_paint_id,
      row.primer_id,
      row.walls_primer_id,
      row.ceiling_primer_id,
      row.trim_primer_id,
      row.override_labor_rate,
      row.override_markup,
      row.rounding_increment_hours,
      row.dayhours,
      row.default_walls_prep_level,
      row.default_ceiling_prep_level,
      row.default_trim_prep_level,
      row.notes,
      row.walls_paint_gal_override,
      row.ceiling_paint_gal_override,
      row.primer_gal_override,
      row.extra_supplies_walls,
      row.extra_supplies_ceilings,
      row.extra_supplies_trim,
      row.trim_paint_gallons,
      row.trim_paint_quarts,
      row.trim_paint_qty,
      row.trim_paint_uom,
      row.trim_primer_qty,
      row.trim_primer_uom,
      row.paint_supplied_by,
      row.crew_size,
      row.standard_door_deduction_sf,
      row.standard_window_deduction_sf,
      row.baseboard_opening_deduction_lf,
      row.labor_day_policy_enabled,
      row.job_minimum_enabled,
      row.job_minimum_amount
    from jsonb_to_record(p_payload->'jobsettings') as row(
      walls_paint_id text,
      ceiling_paint_id text,
      trim_paint_id text,
      primer_id text,
      walls_primer_id text,
      ceiling_primer_id text,
      trim_primer_id text,
      override_labor_rate numeric,
      override_markup numeric,
      rounding_increment_hours numeric,
      dayhours numeric,
      default_walls_prep_level text,
      default_ceiling_prep_level text,
      default_trim_prep_level text,
      notes text,
      walls_paint_gal_override numeric,
      ceiling_paint_gal_override numeric,
      primer_gal_override numeric,
      extra_supplies_walls numeric,
      extra_supplies_ceilings numeric,
      extra_supplies_trim numeric,
      trim_paint_gallons numeric,
      trim_paint_quarts numeric,
      trim_paint_qty numeric,
      trim_paint_uom text,
      trim_primer_qty numeric,
      trim_primer_uom text,
      paint_supplied_by text,
      crew_size numeric,
      standard_door_deduction_sf numeric,
      standard_window_deduction_sf numeric,
      baseboard_opening_deduction_lf numeric,
      labor_day_policy_enabled boolean,
      job_minimum_enabled boolean,
      job_minimum_amount numeric
    )
    on conflict (org_id, estimate_id)
    do update set
      job_id = excluded.job_id,
      walls_paint_id = excluded.walls_paint_id,
      ceiling_paint_id = excluded.ceiling_paint_id,
      trim_paint_id = excluded.trim_paint_id,
      primer_id = excluded.primer_id,
      walls_primer_id = excluded.walls_primer_id,
      ceiling_primer_id = excluded.ceiling_primer_id,
      trim_primer_id = excluded.trim_primer_id,
      override_labor_rate = excluded.override_labor_rate,
      override_markup = excluded.override_markup,
      rounding_increment_hours = excluded.rounding_increment_hours,
      dayhours = excluded.dayhours,
      default_walls_prep_level = excluded.default_walls_prep_level,
      default_ceiling_prep_level = excluded.default_ceiling_prep_level,
      default_trim_prep_level = excluded.default_trim_prep_level,
      notes = excluded.notes,
      walls_paint_gal_override = excluded.walls_paint_gal_override,
      ceiling_paint_gal_override = excluded.ceiling_paint_gal_override,
      primer_gal_override = excluded.primer_gal_override,
      extra_supplies_walls = excluded.extra_supplies_walls,
      extra_supplies_ceilings = excluded.extra_supplies_ceilings,
      extra_supplies_trim = excluded.extra_supplies_trim,
      trim_paint_gallons = excluded.trim_paint_gallons,
      trim_paint_quarts = excluded.trim_paint_quarts,
      trim_paint_qty = excluded.trim_paint_qty,
      trim_paint_uom = excluded.trim_paint_uom,
      trim_primer_qty = excluded.trim_primer_qty,
      trim_primer_uom = excluded.trim_primer_uom,
      paint_supplied_by = excluded.paint_supplied_by,
      crew_size = excluded.crew_size,
      standard_door_deduction_sf = excluded.standard_door_deduction_sf,
      standard_window_deduction_sf = excluded.standard_window_deduction_sf,
      baseboard_opening_deduction_lf = excluded.baseboard_opening_deduction_lf,
      labor_day_policy_enabled = excluded.labor_day_policy_enabled,
      job_minimum_enabled = excluded.job_minimum_enabled,
      job_minimum_amount = excluded.job_minimum_amount,
      updated_at = now();
  end if;

  if p_payload ? 'rooms' and jsonb_typeof(p_payload->'rooms') = 'array' then
    if coalesce(p_payload->>'room_save_mode', 'v2_roster') <> 'v2_roster' then
      raise exception 'Unsupported room_save_mode for Estimate V2 full persistence: %', p_payload->>'room_save_mode';
    end if;

    with input_rooms as (
      select *
      from jsonb_to_recordset(p_payload->'rooms') as row(
        id uuid,
        position int,
        room_id text,
        room_name text,
        room_type_id text,
        mode text,
        length_in numeric,
        width_in numeric,
        wallheight_in numeric,
        ceilingheight_in numeric,
        ceilingsqft_override numeric,
        baseexclude_in numeric,
        walls_include text,
        walls_primer text,
        walls_topcoats numeric,
        wall_primer_coats numeric,
        wall_spot_prime_pct numeric,
        walls_prep_override text,
        walls_prep_level text,
        wall_complexity_id text,
        wall_sqft_override numeric,
        openings_sqft numeric,
        walls_notes text,
        ceiling_include text,
        ceiling_primer text,
        ceiling_topcoats numeric,
        ceiling_prep_level text,
        ceiling_prep_override text,
        ceiling_height_surcharge numeric,
        trim_include text,
        doors_include text,
        drywall_include text,
        trim_primer text,
        trim_topcoats numeric,
        trim_prep_override text,
        doors_prep_override text,
        paint_base text,
        paint_crown text,
        paint_window_casing text,
        paint_door_casing text,
        paint_doors text,
        door_count numeric,
        window_count numeric,
        baseboard_lf numeric,
        crown_lf numeric,
        baseboard_type_id text,
        baseboard_auto text,
        crown_type_id text,
        crown_auto text,
        window_casing_type_id text,
        door_casing_type_id text,
        door_casing_count numeric,
        door_type_id text,
        door_paint_count numeric,
        door_sides numeric,
        auto_calc_trim_perimeter text,
        wall_color_id text,
        ceiling_type_id text,
        paint_supplied_by text,
        notes text,
        condition_selections jsonb
      )
    ),
    matched_rooms as (
      select
        coalesce(existing.id, input.id, gen_random_uuid()) as id,
        p_org_id as org_id,
        p_estimate_id as estimate_id,
        p_job_id as job_id,
        input.position,
        input.room_id,
        input.room_name,
        input.room_type_id,
        coalesce(existing.mode, 'RECT') as mode,
        input.length_in,
        input.width_in,
        input.wallheight_in,
        coalesce(existing.ceilingheight_in, input.wallheight_in) as ceilingheight_in,
        existing.ceilingsqft_override,
        existing.baseexclude_in,
        coalesce(existing.walls_include, 'N') as walls_include,
        existing.walls_primer,
        existing.walls_topcoats,
        existing.wall_primer_coats,
        existing.wall_spot_prime_pct,
        existing.walls_prep_override,
        existing.walls_prep_level,
        input.wall_complexity_id,
        existing.wall_sqft_override,
        existing.openings_sqft,
        existing.walls_notes,
        coalesce(existing.ceiling_include, 'N') as ceiling_include,
        existing.ceiling_primer,
        existing.ceiling_topcoats,
        existing.ceiling_prep_level,
        existing.ceiling_prep_override,
        existing.ceiling_height_surcharge,
        coalesce(existing.trim_include, 'N') as trim_include,
        coalesce(existing.doors_include, 'N') as doors_include,
        coalesce(existing.drywall_include, 'N') as drywall_include,
        existing.trim_primer,
        existing.trim_topcoats,
        existing.trim_prep_override,
        existing.doors_prep_override,
        existing.paint_base,
        existing.paint_crown,
        existing.paint_window_casing,
        existing.paint_door_casing,
        existing.paint_doors,
        existing.door_count,
        existing.window_count,
        existing.baseboard_lf,
        existing.crown_lf,
        existing.baseboard_type_id,
        existing.baseboard_auto,
        existing.crown_type_id,
        existing.crown_auto,
        existing.window_casing_type_id,
        existing.door_casing_type_id,
        existing.door_casing_count,
        existing.door_type_id,
        existing.door_paint_count,
        existing.door_sides,
        existing.auto_calc_trim_perimeter,
        existing.wall_color_id,
        existing.ceiling_type_id,
        existing.paint_supplied_by,
        input.notes,
        input.condition_selections
      from input_rooms input
      left join lateral (
        select e.*
        from public.estimate_rooms e
        where e.org_id = p_org_id
          and e.estimate_id = p_estimate_id
          and (
            (input.id is not null and e.id = input.id)
            or (input.id is null and input.room_id is not null and e.room_id = input.room_id)
          )
        order by case when input.id is not null and e.id = input.id then 0 else 1 end
        limit 1
      ) existing on true
    ),
    deleted as (
      delete from public.estimate_rooms existing
      where existing.org_id = p_org_id
        and existing.estimate_id = p_estimate_id
        and not exists (
          select 1
          from matched_rooms matched
          where matched.id = existing.id
        )
      returning existing.id
    )
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
      ceilingsqft_override,
      baseexclude_in,
      walls_include,
      walls_primer,
      walls_topcoats,
      wall_primer_coats,
      wall_spot_prime_pct,
      walls_prep_override,
      walls_prep_level,
      wall_complexity_id,
      wall_sqft_override,
      openings_sqft,
      walls_notes,
      ceiling_include,
      ceiling_primer,
      ceiling_topcoats,
      ceiling_prep_level,
      ceiling_prep_override,
      ceiling_height_surcharge,
      trim_include,
      doors_include,
      drywall_include,
      trim_primer,
      trim_topcoats,
      trim_prep_override,
      doors_prep_override,
      paint_base,
      paint_crown,
      paint_window_casing,
      paint_door_casing,
      paint_doors,
      door_count,
      window_count,
      baseboard_lf,
      crown_lf,
      baseboard_type_id,
      baseboard_auto,
      crown_type_id,
      crown_auto,
      window_casing_type_id,
      door_casing_type_id,
      door_casing_count,
      door_type_id,
      door_paint_count,
      door_sides,
      auto_calc_trim_perimeter,
      wall_color_id,
      ceiling_type_id,
      paint_supplied_by,
      notes,
      condition_selections
    )
    select
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
      ceilingsqft_override,
      baseexclude_in,
      walls_include,
      walls_primer,
      walls_topcoats,
      wall_primer_coats,
      wall_spot_prime_pct,
      walls_prep_override,
      walls_prep_level,
      wall_complexity_id,
      wall_sqft_override,
      openings_sqft,
      walls_notes,
      ceiling_include,
      ceiling_primer,
      ceiling_topcoats,
      ceiling_prep_level,
      ceiling_prep_override,
      ceiling_height_surcharge,
      trim_include,
      doors_include,
      drywall_include,
      trim_primer,
      trim_topcoats,
      trim_prep_override,
      doors_prep_override,
      paint_base,
      paint_crown,
      paint_window_casing,
      paint_door_casing,
      paint_doors,
      door_count,
      window_count,
      baseboard_lf,
      crown_lf,
      baseboard_type_id,
      baseboard_auto,
      crown_type_id,
      crown_auto,
      window_casing_type_id,
      door_casing_type_id,
      door_casing_count,
      door_type_id,
      door_paint_count,
      door_sides,
      auto_calc_trim_perimeter,
      wall_color_id,
      ceiling_type_id,
      paint_supplied_by,
      notes,
      condition_selections
    from matched_rooms
    on conflict (id)
    do update set
      org_id = excluded.org_id,
      estimate_id = excluded.estimate_id,
      job_id = excluded.job_id,
      position = excluded.position,
      room_id = excluded.room_id,
      room_name = excluded.room_name,
      room_type_id = excluded.room_type_id,
      mode = excluded.mode,
      length_in = excluded.length_in,
      width_in = excluded.width_in,
      wallheight_in = excluded.wallheight_in,
      ceilingheight_in = excluded.ceilingheight_in,
      ceilingsqft_override = excluded.ceilingsqft_override,
      baseexclude_in = excluded.baseexclude_in,
      walls_include = excluded.walls_include,
      walls_primer = excluded.walls_primer,
      walls_topcoats = excluded.walls_topcoats,
      wall_primer_coats = excluded.wall_primer_coats,
      wall_spot_prime_pct = excluded.wall_spot_prime_pct,
      walls_prep_override = excluded.walls_prep_override,
      walls_prep_level = excluded.walls_prep_level,
      wall_complexity_id = excluded.wall_complexity_id,
      wall_sqft_override = excluded.wall_sqft_override,
      openings_sqft = excluded.openings_sqft,
      walls_notes = excluded.walls_notes,
      ceiling_include = excluded.ceiling_include,
      ceiling_primer = excluded.ceiling_primer,
      ceiling_topcoats = excluded.ceiling_topcoats,
      ceiling_prep_level = excluded.ceiling_prep_level,
      ceiling_prep_override = excluded.ceiling_prep_override,
      ceiling_height_surcharge = excluded.ceiling_height_surcharge,
      trim_include = excluded.trim_include,
      doors_include = excluded.doors_include,
      drywall_include = excluded.drywall_include,
      trim_primer = excluded.trim_primer,
      trim_topcoats = excluded.trim_topcoats,
      trim_prep_override = excluded.trim_prep_override,
      doors_prep_override = excluded.doors_prep_override,
      paint_base = excluded.paint_base,
      paint_crown = excluded.paint_crown,
      paint_window_casing = excluded.paint_window_casing,
      paint_door_casing = excluded.paint_door_casing,
      paint_doors = excluded.paint_doors,
      door_count = excluded.door_count,
      window_count = excluded.window_count,
      baseboard_lf = excluded.baseboard_lf,
      crown_lf = excluded.crown_lf,
      baseboard_type_id = excluded.baseboard_type_id,
      baseboard_auto = excluded.baseboard_auto,
      crown_type_id = excluded.crown_type_id,
      crown_auto = excluded.crown_auto,
      window_casing_type_id = excluded.window_casing_type_id,
      door_casing_type_id = excluded.door_casing_type_id,
      door_casing_count = excluded.door_casing_count,
      door_type_id = excluded.door_type_id,
      door_paint_count = excluded.door_paint_count,
      door_sides = excluded.door_sides,
      auto_calc_trim_perimeter = excluded.auto_calc_trim_perimeter,
      wall_color_id = excluded.wall_color_id,
      ceiling_type_id = excluded.ceiling_type_id,
      paint_supplied_by = excluded.paint_supplied_by,
      notes = excluded.notes,
      condition_selections = excluded.condition_selections,
      updated_at = now();
  end if;
  if p_payload ? 'room_wall_scopes' and jsonb_typeof(p_payload->'room_wall_scopes') = 'array' then
    update public.estimate_room_wall_scopes
    set active = 'N'
    where org_id = p_org_id
      and estimate_id = p_estimate_id
      and active = 'Y';

    insert into public.estimate_room_wall_scopes (
      id, org_id, estimate_id, job_id, room_id, position, mode, include, scope_name, color_id,
      paint_product_id, primer_product_id, prime_mode, height_in, perimeter_in,
      standard_door_count, standard_window_count, height_factor, complexity_factor,
      wall_flag_factor, cut_in_top_factor, cut_in_bottom_factor, paint_coats, primer_coats,
      spot_prime_percent, raw_area_sf, override_area_sf, effective_area_sf, raw_paint_hours,
      override_paint_hours, effective_paint_hours, raw_primer_hours, override_primer_hours,
      effective_primer_hours, raw_paint_gallons, override_paint_gallons, effective_paint_gallons,
      raw_primer_gallons, override_primer_gallons, effective_primer_gallons, raw_supply_cost,
      override_supply_cost, effective_supply_cost, raw_total, override_total, effective_total,
      notes, active, condition_selections
    )
    select
      coalesce(row.id, gen_random_uuid()), p_org_id, p_estimate_id, p_job_id, row.room_id, row.position,
      row.mode, row.include, row.scope_name, row.color_id, row.paint_product_id,
      row.primer_product_id, row.prime_mode, row.height_in, row.perimeter_in,
      row.standard_door_count, row.standard_window_count, row.height_factor, row.complexity_factor,
      row.wall_flag_factor, row.cut_in_top_factor, row.cut_in_bottom_factor, row.paint_coats,
      row.primer_coats, row.spot_prime_percent, row.raw_area_sf, row.override_area_sf,
      row.effective_area_sf, row.raw_paint_hours, row.override_paint_hours,
      row.effective_paint_hours, row.raw_primer_hours, row.override_primer_hours,
      row.effective_primer_hours, row.raw_paint_gallons, row.override_paint_gallons,
      row.effective_paint_gallons, row.raw_primer_gallons, row.override_primer_gallons,
      row.effective_primer_gallons, row.raw_supply_cost, row.override_supply_cost,
      row.effective_supply_cost, row.raw_total, row.override_total, row.effective_total,
      row.notes, 'Y', row.condition_selections
    from jsonb_to_recordset(p_payload->'room_wall_scopes') as row(
      id uuid, room_id text, position int, mode text, include text, scope_name text, color_id text,
      paint_product_id text, primer_product_id text, prime_mode text, height_in numeric,
      perimeter_in numeric, standard_door_count numeric, standard_window_count numeric,
      height_factor numeric, complexity_factor numeric, wall_flag_factor numeric,
      cut_in_top_factor numeric, cut_in_bottom_factor numeric, paint_coats numeric,
      primer_coats numeric, spot_prime_percent numeric, raw_area_sf numeric,
      override_area_sf numeric, effective_area_sf numeric, raw_paint_hours numeric,
      override_paint_hours numeric, effective_paint_hours numeric, raw_primer_hours numeric,
      override_primer_hours numeric, effective_primer_hours numeric, raw_paint_gallons numeric,
      override_paint_gallons numeric, effective_paint_gallons numeric, raw_primer_gallons numeric,
      override_primer_gallons numeric, effective_primer_gallons numeric, raw_supply_cost numeric,
      override_supply_cost numeric, effective_supply_cost numeric, raw_total numeric,
      override_total numeric, effective_total numeric, notes text, condition_selections jsonb
    )
    on conflict (id)
    do update set
      org_id = excluded.org_id,
      estimate_id = excluded.estimate_id,
      job_id = excluded.job_id,
      room_id = excluded.room_id,
      position = excluded.position,
      mode = excluded.mode,
      include = excluded.include,
      scope_name = excluded.scope_name,
      color_id = excluded.color_id,
      paint_product_id = excluded.paint_product_id,
      primer_product_id = excluded.primer_product_id,
      prime_mode = excluded.prime_mode,
      height_in = excluded.height_in,
      perimeter_in = excluded.perimeter_in,
      standard_door_count = excluded.standard_door_count,
      standard_window_count = excluded.standard_window_count,
      height_factor = excluded.height_factor,
      complexity_factor = excluded.complexity_factor,
      wall_flag_factor = excluded.wall_flag_factor,
      cut_in_top_factor = excluded.cut_in_top_factor,
      cut_in_bottom_factor = excluded.cut_in_bottom_factor,
      paint_coats = excluded.paint_coats,
      primer_coats = excluded.primer_coats,
      spot_prime_percent = excluded.spot_prime_percent,
      raw_area_sf = excluded.raw_area_sf,
      override_area_sf = excluded.override_area_sf,
      effective_area_sf = excluded.effective_area_sf,
      raw_paint_hours = excluded.raw_paint_hours,
      override_paint_hours = excluded.override_paint_hours,
      effective_paint_hours = excluded.effective_paint_hours,
      raw_primer_hours = excluded.raw_primer_hours,
      override_primer_hours = excluded.override_primer_hours,
      effective_primer_hours = excluded.effective_primer_hours,
      raw_paint_gallons = excluded.raw_paint_gallons,
      override_paint_gallons = excluded.override_paint_gallons,
      effective_paint_gallons = excluded.effective_paint_gallons,
      raw_primer_gallons = excluded.raw_primer_gallons,
      override_primer_gallons = excluded.override_primer_gallons,
      effective_primer_gallons = excluded.effective_primer_gallons,
      raw_supply_cost = excluded.raw_supply_cost,
      override_supply_cost = excluded.override_supply_cost,
      effective_supply_cost = excluded.effective_supply_cost,
      raw_total = excluded.raw_total,
      override_total = excluded.override_total,
      effective_total = excluded.effective_total,
      notes = excluded.notes,
      active = 'Y',
      condition_selections = excluded.condition_selections,
      updated_at = now();
  end if;

  if p_payload ? 'wall_segments' and jsonb_typeof(p_payload->'wall_segments') = 'array' then
    update public.estimate_segments
    set active = 'N'
    where org_id = p_org_id
      and estimate_id = p_estimate_id
      and active = 'Y'
      and wall_scope_id is not null;

    insert into public.estimate_segments (
      id, org_id, estimate_id, job_id, wall_scope_id, room_id, position, seg_no, segment_name,
      include, shape_type, quantity, width_in, height_in, base_in, manual_area_sf,
      standard_door_count, standard_window_count, raw_area_sf, override_area_sf,
      effective_area_sf, notes, active
    )
    select
      coalesce(row.id, gen_random_uuid()), p_org_id, p_estimate_id, p_job_id, row.wall_scope_id,
      row.room_id, row.position, row.seg_no, row.segment_name, row.include, row.shape_type,
      row.quantity, row.width_in, row.height_in, row.base_in, row.manual_area_sf,
      row.standard_door_count, row.standard_window_count, row.raw_area_sf, row.override_area_sf,
      row.effective_area_sf, row.notes, 'Y'
    from jsonb_to_recordset(p_payload->'wall_segments') as row(
      id uuid, wall_scope_id uuid, room_id text, position int, seg_no int, segment_name text,
      include text, shape_type text, quantity numeric, width_in numeric, height_in numeric,
      base_in numeric, manual_area_sf numeric, standard_door_count numeric,
      standard_window_count numeric, raw_area_sf numeric, override_area_sf numeric,
      effective_area_sf numeric, notes text
    )
    on conflict (id)
    do update set
      org_id = excluded.org_id,
      estimate_id = excluded.estimate_id,
      job_id = excluded.job_id,
      wall_scope_id = excluded.wall_scope_id,
      room_id = excluded.room_id,
      position = excluded.position,
      seg_no = excluded.seg_no,
      segment_name = excluded.segment_name,
      include = excluded.include,
      shape_type = excluded.shape_type,
      quantity = excluded.quantity,
      width_in = excluded.width_in,
      height_in = excluded.height_in,
      base_in = excluded.base_in,
      manual_area_sf = excluded.manual_area_sf,
      standard_door_count = excluded.standard_door_count,
      standard_window_count = excluded.standard_window_count,
      raw_area_sf = excluded.raw_area_sf,
      override_area_sf = excluded.override_area_sf,
      effective_area_sf = excluded.effective_area_sf,
      notes = excluded.notes,
      active = 'Y',
      updated_at = now();
  end if;

  if p_payload ? 'room_ceiling_scopes' and jsonb_typeof(p_payload->'room_ceiling_scopes') = 'array' then
    update public.estimate_room_ceiling_scopes
    set active = 'N'
    where org_id = p_org_id
      and estimate_id = p_estimate_id
      and active = 'Y';

    insert into public.estimate_room_ceiling_scopes (
      id, org_id, estimate_id, job_id, room_id, position, mode, include, scope_name, color_id,
      paint_product_id, primer_product_id, prime_mode, spot_prime_percent, ceiling_type_id,
      ceiling_geometry_mode, vaulted_area_factor, vaulted_ridge_length_in, vaulted_slope_length_in,
      vaulted_plane_count, tray_perimeter_in, tray_step_height_in, tray_band_width_in,
      coffer_section_length_in, coffer_section_width_in, coffer_section_count,
      coffer_face_height_in, coffer_bottom_width_in, helper_extra_area_sf, length_in, width_in,
      area_sf, height_factor, complexity_factor, ceiling_flag_factor, override_area_sf,
      override_paint_hours, override_primer_hours, override_paint_gallons,
      override_primer_gallons, override_supply_cost, override_total, raw_area_sf,
      effective_area_sf, raw_paint_hours, effective_paint_hours, raw_primer_hours,
      effective_primer_hours, raw_paint_gallons, effective_paint_gallons, raw_primer_gallons,
      effective_primer_gallons, raw_supply_cost, effective_supply_cost, raw_total, effective_total,
      paint_coats, primer_coats, paint_prod_rate_sqft_per_hour, primer_prod_rate_sqft_per_hour,
      paint_coverage_sqft_per_gal_per_coat, primer_coverage_sqft_per_gal_per_coat,
      area_supply_cost_per_sf, per_color_supply_cost, labor_rate_per_hour, paint_price_per_gal,
      primer_price_per_gal, notes, active, condition_selections
    )
    select
      coalesce(row.id, gen_random_uuid()), p_org_id, p_estimate_id, p_job_id, row.room_id, row.position,
      row.mode, row.include, row.scope_name, row.color_id, row.paint_product_id, row.primer_product_id,
      row.prime_mode, row.spot_prime_percent, row.ceiling_type_id, row.ceiling_geometry_mode,
      row.vaulted_area_factor, row.vaulted_ridge_length_in, row.vaulted_slope_length_in,
      row.vaulted_plane_count, row.tray_perimeter_in, row.tray_step_height_in, row.tray_band_width_in,
      row.coffer_section_length_in, row.coffer_section_width_in, row.coffer_section_count,
      row.coffer_face_height_in, row.coffer_bottom_width_in, row.helper_extra_area_sf, row.length_in,
      row.width_in, row.area_sf, row.height_factor, row.complexity_factor, row.ceiling_flag_factor,
      row.override_area_sf, row.override_paint_hours, row.override_primer_hours,
      row.override_paint_gallons, row.override_primer_gallons, row.override_supply_cost,
      row.override_total, row.raw_area_sf, row.effective_area_sf, row.raw_paint_hours,
      row.effective_paint_hours, row.raw_primer_hours, row.effective_primer_hours,
      row.raw_paint_gallons, row.effective_paint_gallons, row.raw_primer_gallons,
      row.effective_primer_gallons, row.raw_supply_cost, row.effective_supply_cost,
      row.raw_total, row.effective_total, row.paint_coats, row.primer_coats,
      row.paint_prod_rate_sqft_per_hour, row.primer_prod_rate_sqft_per_hour,
      row.paint_coverage_sqft_per_gal_per_coat, row.primer_coverage_sqft_per_gal_per_coat,
      row.area_supply_cost_per_sf, row.per_color_supply_cost, row.labor_rate_per_hour,
      row.paint_price_per_gal, row.primer_price_per_gal, row.notes, 'Y', row.condition_selections
    from jsonb_to_recordset(p_payload->'room_ceiling_scopes') as row(
      id uuid, room_id text, position int, mode text, include text, scope_name text, color_id text,
      paint_product_id text, primer_product_id text, prime_mode text, spot_prime_percent numeric,
      ceiling_type_id text, ceiling_geometry_mode text, vaulted_area_factor numeric,
      vaulted_ridge_length_in numeric, vaulted_slope_length_in numeric, vaulted_plane_count numeric,
      tray_perimeter_in numeric, tray_step_height_in numeric, tray_band_width_in numeric,
      coffer_section_length_in numeric, coffer_section_width_in numeric, coffer_section_count numeric,
      coffer_face_height_in numeric, coffer_bottom_width_in numeric, helper_extra_area_sf numeric,
      length_in numeric, width_in numeric, area_sf numeric, height_factor numeric,
      complexity_factor numeric, ceiling_flag_factor numeric, override_area_sf numeric,
      override_paint_hours numeric, override_primer_hours numeric, override_paint_gallons numeric,
      override_primer_gallons numeric, override_supply_cost numeric, override_total numeric,
      raw_area_sf numeric, effective_area_sf numeric, raw_paint_hours numeric,
      effective_paint_hours numeric, raw_primer_hours numeric, effective_primer_hours numeric,
      raw_paint_gallons numeric, effective_paint_gallons numeric, raw_primer_gallons numeric,
      effective_primer_gallons numeric, raw_supply_cost numeric, effective_supply_cost numeric,
      raw_total numeric, effective_total numeric, paint_coats numeric, primer_coats numeric,
      paint_prod_rate_sqft_per_hour numeric, primer_prod_rate_sqft_per_hour numeric,
      paint_coverage_sqft_per_gal_per_coat numeric, primer_coverage_sqft_per_gal_per_coat numeric,
      area_supply_cost_per_sf numeric, per_color_supply_cost numeric, labor_rate_per_hour numeric,
      paint_price_per_gal numeric, primer_price_per_gal numeric, notes text, condition_selections jsonb
    )
    on conflict (id)
    do update set
      org_id = excluded.org_id,
      estimate_id = excluded.estimate_id,
      job_id = excluded.job_id,
      room_id = excluded.room_id,
      position = excluded.position,
      mode = excluded.mode,
      include = excluded.include,
      scope_name = excluded.scope_name,
      color_id = excluded.color_id,
      paint_product_id = excluded.paint_product_id,
      primer_product_id = excluded.primer_product_id,
      prime_mode = excluded.prime_mode,
      spot_prime_percent = excluded.spot_prime_percent,
      ceiling_type_id = excluded.ceiling_type_id,
      ceiling_geometry_mode = excluded.ceiling_geometry_mode,
      vaulted_area_factor = excluded.vaulted_area_factor,
      vaulted_ridge_length_in = excluded.vaulted_ridge_length_in,
      vaulted_slope_length_in = excluded.vaulted_slope_length_in,
      vaulted_plane_count = excluded.vaulted_plane_count,
      tray_perimeter_in = excluded.tray_perimeter_in,
      tray_step_height_in = excluded.tray_step_height_in,
      tray_band_width_in = excluded.tray_band_width_in,
      coffer_section_length_in = excluded.coffer_section_length_in,
      coffer_section_width_in = excluded.coffer_section_width_in,
      coffer_section_count = excluded.coffer_section_count,
      coffer_face_height_in = excluded.coffer_face_height_in,
      coffer_bottom_width_in = excluded.coffer_bottom_width_in,
      helper_extra_area_sf = excluded.helper_extra_area_sf,
      length_in = excluded.length_in,
      width_in = excluded.width_in,
      area_sf = excluded.area_sf,
      height_factor = excluded.height_factor,
      complexity_factor = excluded.complexity_factor,
      ceiling_flag_factor = excluded.ceiling_flag_factor,
      override_area_sf = excluded.override_area_sf,
      override_paint_hours = excluded.override_paint_hours,
      override_primer_hours = excluded.override_primer_hours,
      override_paint_gallons = excluded.override_paint_gallons,
      override_primer_gallons = excluded.override_primer_gallons,
      override_supply_cost = excluded.override_supply_cost,
      override_total = excluded.override_total,
      raw_area_sf = excluded.raw_area_sf,
      effective_area_sf = excluded.effective_area_sf,
      raw_paint_hours = excluded.raw_paint_hours,
      effective_paint_hours = excluded.effective_paint_hours,
      raw_primer_hours = excluded.raw_primer_hours,
      effective_primer_hours = excluded.effective_primer_hours,
      raw_paint_gallons = excluded.raw_paint_gallons,
      effective_paint_gallons = excluded.effective_paint_gallons,
      raw_primer_gallons = excluded.raw_primer_gallons,
      effective_primer_gallons = excluded.effective_primer_gallons,
      raw_supply_cost = excluded.raw_supply_cost,
      effective_supply_cost = excluded.effective_supply_cost,
      raw_total = excluded.raw_total,
      effective_total = excluded.effective_total,
      paint_coats = excluded.paint_coats,
      primer_coats = excluded.primer_coats,
      paint_prod_rate_sqft_per_hour = excluded.paint_prod_rate_sqft_per_hour,
      primer_prod_rate_sqft_per_hour = excluded.primer_prod_rate_sqft_per_hour,
      paint_coverage_sqft_per_gal_per_coat = excluded.paint_coverage_sqft_per_gal_per_coat,
      primer_coverage_sqft_per_gal_per_coat = excluded.primer_coverage_sqft_per_gal_per_coat,
      area_supply_cost_per_sf = excluded.area_supply_cost_per_sf,
      per_color_supply_cost = excluded.per_color_supply_cost,
      labor_rate_per_hour = excluded.labor_rate_per_hour,
      paint_price_per_gal = excluded.paint_price_per_gal,
      primer_price_per_gal = excluded.primer_price_per_gal,
      notes = excluded.notes,
      active = 'Y',
      condition_selections = excluded.condition_selections,
      updated_at = now();
  end if;

  if p_payload ? 'ceiling_scope_segments' and jsonb_typeof(p_payload->'ceiling_scope_segments') = 'array' then
    update public.estimate_room_ceiling_scope_segments
    set active = 'N'
    where org_id = p_org_id
      and estimate_id = p_estimate_id
      and active = 'Y';

    insert into public.estimate_room_ceiling_scope_segments (
      id, org_id, estimate_id, job_id, ceiling_scope_id, room_id, position, segment_name,
      include, shape_type, quantity, width_in, height_in, base_in, manual_area_sf, raw_area_sf,
      override_area_sf, effective_area_sf, notes, active
    )
    select
      coalesce(row.id, gen_random_uuid()), p_org_id, p_estimate_id, p_job_id, row.ceiling_scope_id,
      row.room_id, row.position, row.segment_name, row.include, row.shape_type, row.quantity,
      row.width_in, row.height_in, row.base_in, row.manual_area_sf, row.raw_area_sf,
      row.override_area_sf, row.effective_area_sf, row.notes, 'Y'
    from jsonb_to_recordset(p_payload->'ceiling_scope_segments') as row(
      id uuid, ceiling_scope_id uuid, room_id text, position int, segment_name text, include text,
      shape_type text, quantity numeric, width_in numeric, height_in numeric, base_in numeric,
      manual_area_sf numeric, raw_area_sf numeric, override_area_sf numeric,
      effective_area_sf numeric, notes text
    )
    on conflict (id)
    do update set
      org_id = excluded.org_id,
      estimate_id = excluded.estimate_id,
      job_id = excluded.job_id,
      ceiling_scope_id = excluded.ceiling_scope_id,
      room_id = excluded.room_id,
      position = excluded.position,
      segment_name = excluded.segment_name,
      include = excluded.include,
      shape_type = excluded.shape_type,
      quantity = excluded.quantity,
      width_in = excluded.width_in,
      height_in = excluded.height_in,
      base_in = excluded.base_in,
      manual_area_sf = excluded.manual_area_sf,
      raw_area_sf = excluded.raw_area_sf,
      override_area_sf = excluded.override_area_sf,
      effective_area_sf = excluded.effective_area_sf,
      notes = excluded.notes,
      active = 'Y',
      updated_at = now();
  end if;

  if p_payload ? 'room_trim_scopes' and jsonb_typeof(p_payload->'room_trim_scopes') = 'array' then
    update public.estimate_room_trim_scopes
    set active = 'N'
    where org_id = p_org_id
      and estimate_id = p_estimate_id
      and active = 'Y';

    insert into public.estimate_room_trim_scopes (
      id, org_id, estimate_id, job_id, room_id, position, include, scope_name, trim_type_id,
      trim_family, unit_type, measurement_mode, helper_source, measurement_value, helper_value,
      baseboard_opening_count, color_id, paint_product_id, primer_product_id, paint_enabled,
      prime_mode, spot_prime_percent, production_rate_id, prep_factor, height_factor,
      profile_factor, room_flag_factor, masking_factor, stair_factor, difficult_finish_factor,
      caulk_fill_factor, override_measurement, override_hours, override_gallons,
      override_supply_cost, override_total, override_description, raw_measurement,
      effective_measurement, raw_paint_hours, effective_paint_hours, raw_primer_hours,
      effective_primer_hours, raw_paint_gallons, effective_paint_gallons, raw_primer_gallons,
      effective_primer_gallons, raw_supply_cost, effective_supply_cost, raw_total, effective_total,
      paint_coats, primer_coats, paint_prod_rate_units_per_hour, primer_prod_rate_units_per_hour,
      paint_coverage_units_per_gal_per_coat, primer_coverage_units_per_gal_per_coat,
      area_supply_cost_per_unit, per_color_supply_cost, labor_rate_per_hour, paint_price_per_gal,
      primer_price_per_gal, notes, active, condition_selections
    )
    select
      coalesce(row.id, gen_random_uuid()), p_org_id, p_estimate_id, p_job_id, row.room_id, row.position,
      row.include, row.scope_name, row.trim_type_id, row.trim_family, row.unit_type,
      row.measurement_mode, row.helper_source, row.measurement_value, row.helper_value,
      row.baseboard_opening_count, row.color_id, row.paint_product_id, row.primer_product_id,
      row.paint_enabled, row.prime_mode, row.spot_prime_percent, row.production_rate_id,
      row.prep_factor, row.height_factor, row.profile_factor, row.room_flag_factor,
      row.masking_factor, row.stair_factor, row.difficult_finish_factor, row.caulk_fill_factor,
      row.override_measurement, row.override_hours, row.override_gallons, row.override_supply_cost,
      row.override_total, row.override_description, row.raw_measurement, row.effective_measurement,
      row.raw_paint_hours, row.effective_paint_hours, row.raw_primer_hours,
      row.effective_primer_hours, row.raw_paint_gallons, row.effective_paint_gallons,
      row.raw_primer_gallons, row.effective_primer_gallons, row.raw_supply_cost,
      row.effective_supply_cost, row.raw_total, row.effective_total, row.paint_coats,
      row.primer_coats, row.paint_prod_rate_units_per_hour, row.primer_prod_rate_units_per_hour,
      row.paint_coverage_units_per_gal_per_coat, row.primer_coverage_units_per_gal_per_coat,
      row.area_supply_cost_per_unit, row.per_color_supply_cost, row.labor_rate_per_hour,
      row.paint_price_per_gal, row.primer_price_per_gal, row.notes, 'Y', row.condition_selections
    from jsonb_to_recordset(p_payload->'room_trim_scopes') as row(
      id uuid, room_id text, position int, include text, scope_name text, trim_type_id text,
      trim_family text, unit_type text, measurement_mode text, helper_source text,
      measurement_value numeric, helper_value numeric, baseboard_opening_count numeric,
      color_id text, paint_product_id text, primer_product_id text, paint_enabled text,
      prime_mode text, spot_prime_percent numeric, production_rate_id text, prep_factor numeric,
      height_factor numeric, profile_factor numeric, room_flag_factor numeric, masking_factor numeric,
      stair_factor numeric, difficult_finish_factor numeric, caulk_fill_factor numeric,
      override_measurement numeric, override_hours numeric, override_gallons numeric,
      override_supply_cost numeric, override_total numeric, override_description text,
      raw_measurement numeric, effective_measurement numeric, raw_paint_hours numeric,
      effective_paint_hours numeric, raw_primer_hours numeric, effective_primer_hours numeric,
      raw_paint_gallons numeric, effective_paint_gallons numeric, raw_primer_gallons numeric,
      effective_primer_gallons numeric, raw_supply_cost numeric, effective_supply_cost numeric,
      raw_total numeric, effective_total numeric, paint_coats numeric, primer_coats numeric,
      paint_prod_rate_units_per_hour numeric, primer_prod_rate_units_per_hour numeric,
      paint_coverage_units_per_gal_per_coat numeric, primer_coverage_units_per_gal_per_coat numeric,
      area_supply_cost_per_unit numeric, per_color_supply_cost numeric, labor_rate_per_hour numeric,
      paint_price_per_gal numeric, primer_price_per_gal numeric, notes text,
      condition_selections jsonb
    )
    on conflict (id)
    do update set
      org_id = excluded.org_id,
      estimate_id = excluded.estimate_id,
      job_id = excluded.job_id,
      room_id = excluded.room_id,
      position = excluded.position,
      include = excluded.include,
      scope_name = excluded.scope_name,
      trim_type_id = excluded.trim_type_id,
      trim_family = excluded.trim_family,
      unit_type = excluded.unit_type,
      measurement_mode = excluded.measurement_mode,
      helper_source = excluded.helper_source,
      measurement_value = excluded.measurement_value,
      helper_value = excluded.helper_value,
      baseboard_opening_count = excluded.baseboard_opening_count,
      color_id = excluded.color_id,
      paint_product_id = excluded.paint_product_id,
      primer_product_id = excluded.primer_product_id,
      paint_enabled = excluded.paint_enabled,
      prime_mode = excluded.prime_mode,
      spot_prime_percent = excluded.spot_prime_percent,
      production_rate_id = excluded.production_rate_id,
      prep_factor = excluded.prep_factor,
      height_factor = excluded.height_factor,
      profile_factor = excluded.profile_factor,
      room_flag_factor = excluded.room_flag_factor,
      masking_factor = excluded.masking_factor,
      stair_factor = excluded.stair_factor,
      difficult_finish_factor = excluded.difficult_finish_factor,
      caulk_fill_factor = excluded.caulk_fill_factor,
      override_measurement = excluded.override_measurement,
      override_hours = excluded.override_hours,
      override_gallons = excluded.override_gallons,
      override_supply_cost = excluded.override_supply_cost,
      override_total = excluded.override_total,
      override_description = excluded.override_description,
      raw_measurement = excluded.raw_measurement,
      effective_measurement = excluded.effective_measurement,
      raw_paint_hours = excluded.raw_paint_hours,
      effective_paint_hours = excluded.effective_paint_hours,
      raw_primer_hours = excluded.raw_primer_hours,
      effective_primer_hours = excluded.effective_primer_hours,
      raw_paint_gallons = excluded.raw_paint_gallons,
      effective_paint_gallons = excluded.effective_paint_gallons,
      raw_primer_gallons = excluded.raw_primer_gallons,
      effective_primer_gallons = excluded.effective_primer_gallons,
      raw_supply_cost = excluded.raw_supply_cost,
      effective_supply_cost = excluded.effective_supply_cost,
      raw_total = excluded.raw_total,
      effective_total = excluded.effective_total,
      paint_coats = excluded.paint_coats,
      primer_coats = excluded.primer_coats,
      paint_prod_rate_units_per_hour = excluded.paint_prod_rate_units_per_hour,
      primer_prod_rate_units_per_hour = excluded.primer_prod_rate_units_per_hour,
      paint_coverage_units_per_gal_per_coat = excluded.paint_coverage_units_per_gal_per_coat,
      primer_coverage_units_per_gal_per_coat = excluded.primer_coverage_units_per_gal_per_coat,
      area_supply_cost_per_unit = excluded.area_supply_cost_per_unit,
      per_color_supply_cost = excluded.per_color_supply_cost,
      labor_rate_per_hour = excluded.labor_rate_per_hour,
      paint_price_per_gal = excluded.paint_price_per_gal,
      primer_price_per_gal = excluded.primer_price_per_gal,
      notes = excluded.notes,
      active = 'Y',
      condition_selections = excluded.condition_selections,
      updated_at = now();
  end if;

  if p_payload ? 'room_door_scopes' and jsonb_typeof(p_payload->'room_door_scopes') = 'array' then
    update public.estimate_room_door_scopes
    set active = 'N'
    where org_id = p_org_id
      and estimate_id = p_estimate_id
      and active = 'Y';

    insert into public.estimate_room_door_scopes (
      id, org_id, estimate_id, job_id, room_id, position, include, scope_name, door_type_id,
      color_id, paint_product_id, primer_product_id, prime_mode, quantity, sides, paint_coats,
      primer_coats, spot_prime_percent, condition_factor, labor_rate, material_rate, raw_units,
      effective_units, raw_paint_hours, override_paint_hours, effective_paint_hours,
      raw_primer_hours, override_primer_hours, effective_primer_hours, raw_material_cost,
      override_material_cost, effective_material_cost, raw_supply_cost, override_supply_cost,
      effective_supply_cost, raw_total, override_total, effective_total, notes, active
    )
    select
      coalesce(row.id, gen_random_uuid()), p_org_id, p_estimate_id, p_job_id, row.room_id, row.position,
      row.include, row.scope_name, row.door_type_id, row.color_id, row.paint_product_id,
      row.primer_product_id, row.prime_mode, row.quantity, row.sides, row.paint_coats,
      row.primer_coats, row.spot_prime_percent, row.condition_factor, row.labor_rate,
      row.material_rate, row.raw_units, row.effective_units, row.raw_paint_hours,
      row.override_paint_hours, row.effective_paint_hours, row.raw_primer_hours,
      row.override_primer_hours, row.effective_primer_hours, row.raw_material_cost,
      row.override_material_cost, row.effective_material_cost, row.raw_supply_cost,
      row.override_supply_cost, row.effective_supply_cost, row.raw_total, row.override_total,
      row.effective_total, row.notes, 'Y'
    from jsonb_to_recordset(p_payload->'room_door_scopes') as row(
      id uuid, room_id text, position int, include text, scope_name text, door_type_id text,
      color_id text, paint_product_id text, primer_product_id text, prime_mode text,
      quantity numeric, sides numeric, paint_coats numeric, primer_coats numeric,
      spot_prime_percent numeric, condition_factor numeric, labor_rate numeric, material_rate numeric,
      raw_units numeric, effective_units numeric, raw_paint_hours numeric,
      override_paint_hours numeric, effective_paint_hours numeric, raw_primer_hours numeric,
      override_primer_hours numeric, effective_primer_hours numeric, raw_material_cost numeric,
      override_material_cost numeric, effective_material_cost numeric, raw_supply_cost numeric,
      override_supply_cost numeric, effective_supply_cost numeric, raw_total numeric,
      override_total numeric, effective_total numeric, notes text
    )
    on conflict (id)
    do update set
      org_id = excluded.org_id,
      estimate_id = excluded.estimate_id,
      job_id = excluded.job_id,
      room_id = excluded.room_id,
      position = excluded.position,
      include = excluded.include,
      scope_name = excluded.scope_name,
      door_type_id = excluded.door_type_id,
      color_id = excluded.color_id,
      paint_product_id = excluded.paint_product_id,
      primer_product_id = excluded.primer_product_id,
      prime_mode = excluded.prime_mode,
      quantity = excluded.quantity,
      sides = excluded.sides,
      paint_coats = excluded.paint_coats,
      primer_coats = excluded.primer_coats,
      spot_prime_percent = excluded.spot_prime_percent,
      condition_factor = excluded.condition_factor,
      labor_rate = excluded.labor_rate,
      material_rate = excluded.material_rate,
      raw_units = excluded.raw_units,
      effective_units = excluded.effective_units,
      raw_paint_hours = excluded.raw_paint_hours,
      override_paint_hours = excluded.override_paint_hours,
      effective_paint_hours = excluded.effective_paint_hours,
      raw_primer_hours = excluded.raw_primer_hours,
      override_primer_hours = excluded.override_primer_hours,
      effective_primer_hours = excluded.effective_primer_hours,
      raw_material_cost = excluded.raw_material_cost,
      override_material_cost = excluded.override_material_cost,
      effective_material_cost = excluded.effective_material_cost,
      raw_supply_cost = excluded.raw_supply_cost,
      override_supply_cost = excluded.override_supply_cost,
      effective_supply_cost = excluded.effective_supply_cost,
      raw_total = excluded.raw_total,
      override_total = excluded.override_total,
      effective_total = excluded.effective_total,
      notes = excluded.notes,
      active = 'Y',
      updated_at = now();
  end if;

  if p_payload ? 'drywall_repairs' and jsonb_typeof(p_payload->'drywall_repairs') = 'array' then
    update public.estimate_drywall_repairs
    set active = 'N'
    where org_id = p_org_id
      and estimate_id = p_estimate_id
      and active = 'Y';

    insert into public.estimate_drywall_repairs (
      id, org_id, estimate_id, job_id, room_id, position, surface, repair_type, unit, quantity,
      raw_quantity, effective_quantity, base_unit_rate, ceiling_multiplier, calculated_total,
      override_total, raw_total, effective_total, active
    )
    select
      coalesce(row.id, gen_random_uuid()), p_org_id, p_estimate_id, p_job_id, row.room_id, row.position,
      row.surface, row.repair_type, row.unit, row.quantity, row.raw_quantity, row.effective_quantity,
      row.base_unit_rate, row.ceiling_multiplier, row.calculated_total, row.override_total,
      row.raw_total, row.effective_total, coalesce(row.active, 'Y')
    from jsonb_to_recordset(p_payload->'drywall_repairs') as row(
      id uuid, room_id text, position int, surface text, repair_type text, unit text,
      quantity numeric, raw_quantity numeric, effective_quantity numeric, base_unit_rate numeric,
      ceiling_multiplier numeric, calculated_total numeric, override_total numeric,
      raw_total numeric, effective_total numeric, active text
    )
    on conflict (id)
    do update set
      org_id = excluded.org_id,
      estimate_id = excluded.estimate_id,
      job_id = excluded.job_id,
      room_id = excluded.room_id,
      position = excluded.position,
      surface = excluded.surface,
      repair_type = excluded.repair_type,
      unit = excluded.unit,
      quantity = excluded.quantity,
      raw_quantity = excluded.raw_quantity,
      effective_quantity = excluded.effective_quantity,
      base_unit_rate = excluded.base_unit_rate,
      ceiling_multiplier = excluded.ceiling_multiplier,
      calculated_total = excluded.calculated_total,
      override_total = excluded.override_total,
      raw_total = excluded.raw_total,
      effective_total = excluded.effective_total,
      active = excluded.active,
      updated_at = now();
  end if;

  if p_payload ? 'rollers' and jsonb_typeof(p_payload->'rollers') = 'array' then
    update public.estimate_rollers
    set active = 'N'
    where org_id = p_org_id
      and estimate_id = p_estimate_id
      and active = 'Y';

    insert into public.estimate_rollers (
      id, org_id, estimate_id, job_id, position, scope, wall_color_id, selected_option_id,
      roller_size_in, covers_qty, notes, active
    )
    select
      coalesce(row.id, gen_random_uuid()), p_org_id, p_estimate_id, p_job_id, row.position, row.scope,
      row.wall_color_id, row.selected_option_id, row.roller_size_in, row.covers_qty, row.notes,
      coalesce(row.active, 'Y')
    from jsonb_to_recordset(p_payload->'rollers') as row(
      id uuid, position int, scope text, wall_color_id text, selected_option_id text,
      roller_size_in numeric, covers_qty numeric, notes text, active text
    )
    on conflict (id)
    do update set
      org_id = excluded.org_id,
      estimate_id = excluded.estimate_id,
      job_id = excluded.job_id,
      position = excluded.position,
      scope = excluded.scope,
      wall_color_id = excluded.wall_color_id,
      selected_option_id = excluded.selected_option_id,
      roller_size_in = excluded.roller_size_in,
      covers_qty = excluded.covers_qty,
      notes = excluded.notes,
      active = excluded.active,
      updated_at = now();
  end if;

  if p_payload ? 'job_colors' and jsonb_typeof(p_payload->'job_colors') = 'array' then
    update public.estimate_job_colors
    set active = 'N'
    where org_id = p_org_id
      and estimate_id = p_estimate_id
      and active = 'Y';

    insert into public.estimate_job_colors (
      id, org_id, estimate_id, job_id, position, color_id, color_name, roller_cover_id,
      roller_cover_qty, active
    )
    select
      coalesce(row.id, gen_random_uuid()), p_org_id, p_estimate_id, p_job_id, row.position, row.color_id,
      row.color_name, row.roller_cover_id, row.roller_cover_qty, coalesce(row.active, 'Y')
    from jsonb_to_recordset(p_payload->'job_colors') as row(
      id uuid, position int, color_id text, color_name text, roller_cover_id text,
      roller_cover_qty numeric, active text
    )
    on conflict (id)
    do update set
      org_id = excluded.org_id,
      estimate_id = excluded.estimate_id,
      job_id = excluded.job_id,
      position = excluded.position,
      color_id = excluded.color_id,
      color_name = excluded.color_name,
      roller_cover_id = excluded.roller_cover_id,
      roller_cover_qty = excluded.roller_cover_qty,
      active = excluded.active,
      updated_at = now();
  end if;

  if p_payload ? 'room_flags' and jsonb_typeof(p_payload->'room_flags') = 'array' then
    update public.estimate_room_flags
    set active = 'N'
    where org_id = p_org_id
      and estimate_id = p_estimate_id
      and active = 'Y';

    insert into public.estimate_room_flags (
      id, org_id, estimate_id, job_id, position, room_id, flag_id, active
    )
    select
      coalesce(row.id, gen_random_uuid()), p_org_id, p_estimate_id, p_job_id, row.position,
      row.room_id, row.flag_id, coalesce(row.active, 'Y')
    from jsonb_to_recordset(p_payload->'room_flags') as row(
      id uuid, position int, room_id text, flag_id text, active text
    )
    on conflict (id)
    do update set
      org_id = excluded.org_id,
      estimate_id = excluded.estimate_id,
      job_id = excluded.job_id,
      position = excluded.position,
      room_id = excluded.room_id,
      flag_id = excluded.flag_id,
      active = excluded.active,
      updated_at = now();
  end if;

  if p_payload ? 'access_fees' and jsonb_typeof(p_payload->'access_fees') = 'array' then
    update public.estimate_access_fees
    set active = 'N'
    where org_id = p_org_id
      and estimate_id = p_estimate_id
      and active = 'Y';

    insert into public.estimate_access_fees (
      id, org_id, estimate_id, job_id, position, room_id, segment_num, access_fee_id, qty,
      active, notes, actual_cost_override
    )
    select
      coalesce(access_fee_row.id, gen_random_uuid()), p_org_id, p_estimate_id, p_job_id, access_fee_row.position,
      access_fee_row.room_id, access_fee_row.segment_num, access_fee_row.access_fee_id, access_fee_row.qty, coalesce(access_fee_row.active, 'Y'),
      access_fee_row.notes, access_fee_row.actual_cost_override
    from jsonb_to_recordset(p_payload->'access_fees') as access_fee_row(
      id uuid, position int, room_id text, segment_num numeric, access_fee_id text, qty numeric,
      active text, notes text, actual_cost_override numeric
    )
    on conflict (id)
    do update set
      org_id = excluded.org_id,
      estimate_id = excluded.estimate_id,
      job_id = excluded.job_id,
      position = excluded.position,
      room_id = excluded.room_id,
      segment_num = excluded.segment_num,
      access_fee_id = excluded.access_fee_id,
      qty = excluded.qty,
      active = excluded.active,
      notes = excluded.notes,
      actual_cost_override = excluded.actual_cost_override,
      updated_at = now();
  end if;

  if p_payload ? 'prejob' and jsonb_typeof(p_payload->'prejob') = 'array' then
    update public.estimate_prejob
    set active = 'N'
    where org_id = p_org_id
      and estimate_id = p_estimate_id
      and active = 'Y';

    insert into public.estimate_prejob (
      id, org_id, estimate_id, job_id, position, category, trip_name, room_id, trip_num,
      trip_rate, manual_adjustment, calculated_total, effective_total, rollup_scope,
      man_trip_name, man_qty, man_hours_each, task, qty, hours_each, laborrate, markup,
      extra_supplies, notes, active
    )
    select
      coalesce(row.id, gen_random_uuid()), p_org_id, p_estimate_id, p_job_id, row.position,
      row.category, row.trip_name, row.room_id, row.trip_num, row.trip_rate,
      row.manual_adjustment, row.calculated_total, row.effective_total, row.rollup_scope,
      row.man_trip_name, row.man_qty, row.man_hours_each, row.task, row.qty, row.hours_each,
      row.laborrate, row.markup, row.extra_supplies, row.notes, coalesce(row.active, 'Y')
    from jsonb_to_recordset(p_payload->'prejob') as row(
      id uuid, position int, category text, trip_name text, room_id text, trip_num numeric,
      trip_rate numeric, manual_adjustment numeric, calculated_total numeric, effective_total numeric,
      rollup_scope text, man_trip_name text, man_qty numeric, man_hours_each numeric, task text, qty numeric,
      hours_each numeric, laborrate numeric, markup numeric, extra_supplies numeric, notes text,
      active text
    )
    on conflict (id)
    do update set
      org_id = excluded.org_id,
      estimate_id = excluded.estimate_id,
      job_id = excluded.job_id,
      position = excluded.position,
      category = excluded.category,
      trip_name = excluded.trip_name,
      room_id = excluded.room_id,
      trip_num = excluded.trip_num,
      trip_rate = excluded.trip_rate,
      manual_adjustment = excluded.manual_adjustment,
      calculated_total = excluded.calculated_total,
      effective_total = excluded.effective_total,
      rollup_scope = excluded.rollup_scope,
      man_trip_name = excluded.man_trip_name,
      man_qty = excluded.man_qty,
      man_hours_each = excluded.man_hours_each,
      task = excluded.task,
      qty = excluded.qty,
      hours_each = excluded.hours_each,
      laborrate = excluded.laborrate,
      markup = excluded.markup,
      extra_supplies = excluded.extra_supplies,
      notes = excluded.notes,
      active = excluded.active,
      updated_at = now();
  end if;

  if p_payload ? 'trim_items' and jsonb_typeof(p_payload->'trim_items') = 'array' then
    update public.estimate_trim_items
    set active = 'N'
    where org_id = p_org_id
      and estimate_id = p_estimate_id
      and active = 'Y';

    insert into public.estimate_trim_items (
      id, org_id, estimate_id, job_id, room_id, trim_menu_id, qty, coats, auto_calc, primer_mode,
      spot_prime_pct, prep_level_override, door_sides, notes, active, sort_order
    )
    select
      coalesce(row.id, gen_random_uuid()), p_org_id, p_estimate_id, p_job_id, row.room_id,
      row.trim_menu_id, row.qty, row.coats, row.auto_calc, row.primer_mode, row.spot_prime_pct,
      row.prep_level_override, row.door_sides, row.notes, coalesce(row.active, 'Y'), row.sort_order
    from jsonb_to_recordset(p_payload->'trim_items') as row(
      id uuid, room_id text, trim_menu_id text, qty numeric, coats numeric, auto_calc text,
      primer_mode text, spot_prime_pct numeric, prep_level_override text, door_sides numeric,
      notes text, active text, sort_order int
    )
    on conflict (id)
    do update set
      org_id = excluded.org_id,
      estimate_id = excluded.estimate_id,
      job_id = excluded.job_id,
      room_id = excluded.room_id,
      trim_menu_id = excluded.trim_menu_id,
      qty = excluded.qty,
      coats = excluded.coats,
      auto_calc = excluded.auto_calc,
      primer_mode = excluded.primer_mode,
      spot_prime_pct = excluded.spot_prime_pct,
      prep_level_override = excluded.prep_level_override,
      door_sides = excluded.door_sides,
      notes = excluded.notes,
      active = excluded.active,
      sort_order = excluded.sort_order,
      updated_at = now();
  end if;

  if p_payload ? 'other' and jsonb_typeof(p_payload->'other') = 'array' then
    update public.estimate_other
    set active = 'N'
    where org_id = p_org_id
      and estimate_id = p_estimate_id
      and active = 'Y';

    insert into public.estimate_other (
      id, org_id, estimate_id, job_id, position, rollup_scope, location, client_description, qty,
      uom, labor_hrs_each, materials_each, notes, active, room_id, description, customer_label,
      pricing_mode, quantity, unit_rate, labor_hours, labor_rate, material_cost, supply_cost,
      fixed_amount, rollup_target, customer_visibility, internal_notes
    )
    select
      coalesce(row.id, gen_random_uuid()), p_org_id, p_estimate_id, p_job_id, row.position,
      row.rollup_scope, row.location, row.client_description, row.qty, row.uom, row.labor_hrs_each,
      row.materials_each, row.notes, coalesce(row.active, 'Y'), row.room_id, row.description,
      row.customer_label, row.pricing_mode, row.quantity, row.unit_rate, row.labor_hours,
      row.labor_rate, row.material_cost, row.supply_cost, row.fixed_amount, row.rollup_target,
      row.customer_visibility, row.internal_notes
    from jsonb_to_recordset(p_payload->'other') as row(
      id uuid, position int, rollup_scope text, location text, client_description text, qty numeric,
      uom text, labor_hrs_each numeric, materials_each numeric, notes text, active text,
      room_id text, description text, customer_label text, pricing_mode text, quantity numeric,
      unit_rate numeric, labor_hours numeric, labor_rate numeric, material_cost numeric,
      supply_cost numeric, fixed_amount numeric, rollup_target text, customer_visibility text,
      internal_notes text
    )
    on conflict (id)
    do update set
      org_id = excluded.org_id,
      estimate_id = excluded.estimate_id,
      job_id = excluded.job_id,
      position = excluded.position,
      rollup_scope = excluded.rollup_scope,
      location = excluded.location,
      client_description = excluded.client_description,
      qty = excluded.qty,
      uom = excluded.uom,
      labor_hrs_each = excluded.labor_hrs_each,
      materials_each = excluded.materials_each,
      notes = excluded.notes,
      active = excluded.active,
      room_id = excluded.room_id,
      description = excluded.description,
      customer_label = excluded.customer_label,
      pricing_mode = excluded.pricing_mode,
      quantity = excluded.quantity,
      unit_rate = excluded.unit_rate,
      labor_hours = excluded.labor_hours,
      labor_rate = excluded.labor_rate,
      material_cost = excluded.material_cost,
      supply_cost = excluded.supply_cost,
      fixed_amount = excluded.fixed_amount,
      rollup_target = excluded.rollup_target,
      customer_visibility = excluded.customer_visibility,
      internal_notes = excluded.internal_notes,
      updated_at = now();
  end if;

  update public.estimates
  set updated_at = now()
  where org_id = p_org_id
    and id = p_estimate_id;
end;
$$;
