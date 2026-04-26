-- 065_seed_condition_modifiers_template.sql
-- Seeds default condition_modifiers rows for all existing orgs.
-- Orgs can tune factor values in their template after seeding.

do $$
declare
  _org record;
  _template_id uuid;
begin
  for _org in select distinct org_id from public.estimator_template_constants loop
    select id into _template_id
    from public.estimator_template_constants
    where org_id = _org.org_id
    limit 1;

    if _template_id is null then continue; end if;

    -- ROOM LEVEL
    insert into public.estimator_template_constant_rows
      (org_id, template_id, category_key, row_id, display_name, active, sort_order, values_json)
    values
      (_org.org_id, _template_id, 'condition_modifiers', 'ROOM_FURNISHED', 'Room is furnished', 'Y', 10,
        '{"id":"ROOM_FURNISHED","display_name":"Room is furnished","scope":"room","modifier_type":"binary","factor_field":"","levels":{"active":1.15}}')
    on conflict (org_id, category_key, row_id) do nothing;

    -- WALL CONDITIONS
    insert into public.estimator_template_constant_rows
      (org_id, template_id, category_key, row_id, display_name, active, sort_order, values_json)
    values
      (_org.org_id, _template_id, 'condition_modifiers', 'WALL_CUT_IN', 'Heavy cut-in areas', 'Y', 20,
        '{"id":"WALL_CUT_IN","display_name":"Heavy cut-in areas","scope":"wall","modifier_type":"severity","factor_field":"complexity_factor","levels":{"minor":1.10,"moderate":1.20,"major":1.35}}'),
      (_org.org_id, _template_id, 'condition_modifiers', 'WALL_TEXTURE', 'Heavy wall texture', 'Y', 21,
        '{"id":"WALL_TEXTURE","display_name":"Heavy wall texture","scope":"wall","modifier_type":"severity","factor_field":"complexity_factor","levels":{"minor":1.10,"moderate":1.20,"major":1.30}}')
    on conflict (org_id, category_key, row_id) do nothing;

    -- CEILING CONDITIONS
    insert into public.estimator_template_constant_rows
      (org_id, template_id, category_key, row_id, display_name, active, sort_order, values_json)
    values
      (_org.org_id, _template_id, 'condition_modifiers', 'CEIL_TEXTURE', 'Textured / popcorn ceiling', 'Y', 30,
        '{"id":"CEIL_TEXTURE","display_name":"Textured / popcorn ceiling","scope":"ceiling","modifier_type":"severity","factor_field":"complexity_factor","levels":{"minor":1.15,"moderate":1.30,"major":1.50}}')
    on conflict (org_id, category_key, row_id) do nothing;

    -- TRIM CONDITIONS
    insert into public.estimator_template_constant_rows
      (org_id, template_id, category_key, row_id, display_name, active, sort_order, values_json)
    values
      (_org.org_id, _template_id, 'condition_modifiers', 'TRIM_OIL_BASED', 'Old oil-based paint', 'Y', 40,
        '{"id":"TRIM_OIL_BASED","display_name":"Old oil-based paint","scope":"trim","modifier_type":"binary","factor_field":"difficult_finish_factor","levels":{"active":1.35}}'),
      (_org.org_id, _template_id, 'condition_modifiers', 'TRIM_CAULKING', 'Caulking needed', 'Y', 41,
        '{"id":"TRIM_CAULKING","display_name":"Caulking needed","scope":"trim","modifier_type":"severity","factor_field":"caulk_fill_factor","levels":{"minor":1.10,"moderate":1.25,"major":1.50}}'),
      (_org.org_id, _template_id, 'condition_modifiers', 'TRIM_PREP', 'Heavy prep / sanding', 'Y', 42,
        '{"id":"TRIM_PREP","display_name":"Heavy prep / sanding","scope":"trim","modifier_type":"severity","factor_field":"prep_factor","levels":{"minor":1.10,"moderate":1.25,"major":1.45}}'),
      (_org.org_id, _template_id, 'condition_modifiers', 'TRIM_PROFILE', 'Complex profile (crown, millwork)', 'Y', 43,
        '{"id":"TRIM_PROFILE","display_name":"Complex profile (crown, millwork)","scope":"trim","modifier_type":"severity","factor_field":"profile_factor","levels":{"minor":1.10,"moderate":1.20,"major":1.35}}'),
      (_org.org_id, _template_id, 'condition_modifiers', 'TRIM_STAIRS', 'Stair / step trim', 'Y', 44,
        '{"id":"TRIM_STAIRS","display_name":"Stair / step trim","scope":"trim","modifier_type":"binary","factor_field":"stair_factor","levels":{"active":1.20}}'),
      (_org.org_id, _template_id, 'condition_modifiers', 'TRIM_MASKING', 'Heavy masking needed', 'Y', 45,
        '{"id":"TRIM_MASKING","display_name":"Heavy masking needed","scope":"trim","modifier_type":"severity","factor_field":"masking_factor","levels":{"minor":1.10,"moderate":1.20,"major":1.35}}')
    on conflict (org_id, category_key, row_id) do nothing;

    -- bump template version so clients reload
    update public.estimator_template_constants
    set version = greatest(1, coalesce(version, 0) + 1),
        updated_at = now()
    where id = _template_id;

  end loop;
end $$;
