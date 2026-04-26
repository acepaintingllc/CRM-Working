-- Add trim_category, measurement_class, and picker_group metadata to unit_rates_trim rows.
-- This backfills existing rows by inference so grouping works immediately,
-- while admins can correct categories later via the Rates/Flags editor.

do $$
declare
  _org record;
  _row record;
  _values jsonb;
  _id text;
  _display_name text;
  _unit text;
  _unit_rate_type text;
  _trim_category text;
  _measurement_class text;
  _picker_group text;
  _existing_trim_category text;
  _existing_measurement_class text;
  _existing_picker_group text;
  _touched_orgs uuid[] := '{}';
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

  for _row in
    select r.id, r.org_id, r.template_id, r.row_id, r.display_name, r.active, r.sort_order,
           coalesce(r.values_json, '{}'::jsonb) as values_json
    from public.estimator_template_constant_rows r
    where r.category_key = 'unit_rates_trim'
  loop
    _values := _row.values_json;
    _id := upper(coalesce(nullif(_values->>'id', ''), _row.row_id, ''));
    _display_name := lower(coalesce(nullif(_values->>'display_name', ''), _row.display_name, ''));
    _unit := upper(coalesce(nullif(_values->>'unit', ''), ''));
    _unit_rate_type := lower(coalesce(nullif(_values->>'unit_rate_type', ''), ''));
    _existing_trim_category := lower(nullif(_values->>'trim_category', ''));
    _existing_measurement_class := lower(nullif(_values->>'measurement_class', ''));
    _existing_picker_group := nullif(_values->>'picker_group', '');

    -- Infer trim_category
    if _unit_rate_type like '%baseboard%' or _unit_rate_type like '%shoe%' or _unit_rate_type like '%quarter round%'
       or _display_name like '%baseboard%' or _display_name like '%shoe%' or _display_name like '%quarter round%'
       or _id like '%BASEBOARD%' or _id like '%SHOE%' or _id like '%QUARTER%' then
      _trim_category := 'base';
    elsif _unit_rate_type like '%crown%' or _display_name like '%crown%' or _id like '%CROWN%' then
      _trim_category := 'crown';
    elsif _unit_rate_type like '%casing%' or _display_name like '%casing%' or _id like '%CASING%' then
      _trim_category := 'casing';
    elsif _unit_rate_type like '%rail%' or _display_name like '%rail%' or _id like '%RAIL%' then
      _trim_category := 'rail';
    elsif _unit_rate_type like '%door%' or _unit_rate_type like '%window%'
       or _display_name like '%door%' or _display_name like '%window%'
       or _id like '%DOOR%' or _id like '%WINDOW%' then
      _trim_category := 'door_window';
    elsif _unit_rate_type like '%panel%' or _display_name like '%panel%' or _id like '%PANEL%' then
      _trim_category := 'panel';
    elsif _unit_rate_type like '%fireplace%' or _unit_rate_type like '%built-in%' or _unit_rate_type like '%cabinet%'
       or _unit_rate_type like '%beam%' or _unit_rate_type like '%mantel%' or _unit_rate_type like '%wainscot%'
       or _display_name like '%fireplace%' or _display_name like '%built-in%' or _display_name like '%cabinet%'
       or _display_name like '%beam%' or _display_name like '%mantel%' or _display_name like '%wainscot%'
       or _id like '%FIREPLACE%' or _id like '%BUILTIN%' or _id like '%BUILT-IN%'
       or _id like '%CABINET%' or _id like '%BEAM%' or _id like '%MANTEL%' or _id like '%WAINSCOT%' then
      _trim_category := 'feature';
    else
      _trim_category := 'other';
    end if;

    if _existing_trim_category is not null then
      _trim_category := _existing_trim_category;
    end if;

    -- Infer measurement_class
    if _trim_category in ('base', 'crown', 'casing', 'rail') then
      _measurement_class := 'linear';
    elsif _trim_category = 'door_window' then
      if _unit = 'EA' then
        _measurement_class := 'opening';
      else
        _measurement_class := 'linear';
      end if;
    elsif _trim_category = 'feature' then
      if _unit = 'SF' then
        _measurement_class := 'surface';
      else
        _measurement_class := 'assembly';
      end if;
    elsif _trim_category = 'panel' then
      if _unit = 'SF' then
        _measurement_class := 'surface';
      elsif _unit = 'EA' then
        _measurement_class := 'assembly';
      else
        _measurement_class := 'linear';
      end if;
    else
      -- other: infer from unit
      if _unit = 'LF' then
        _measurement_class := 'linear';
      elsif _unit = 'EA' then
        _measurement_class := 'assembly';
      elsif _unit = 'SF' then
        _measurement_class := 'surface';
      else
        _measurement_class := 'linear';
      end if;
    end if;

    if _existing_measurement_class is not null then
      _measurement_class := _existing_measurement_class;
    end if;

    -- Derive picker_group from category
    _picker_group :=
      case _trim_category
        when 'base' then 'Base'
        when 'crown' then 'Crown'
        when 'casing' then 'Casing'
        when 'rail' then 'Rails'
        when 'door_window' then 'Doors/Windows'
        when 'panel' then 'Panels'
        when 'feature' then 'Features'
        else 'Other'
      end;

    if _existing_picker_group is not null then
      _picker_group := _existing_picker_group;
    end if;

    -- Update values_json with metadata
    _values := jsonb_set(
      _values,
      '{trim_category}',
      to_jsonb(_trim_category)
    );
    _values := jsonb_set(
      _values,
      '{measurement_class}',
      to_jsonb(_measurement_class)
    );
    _values := jsonb_set(
      _values,
      '{picker_group}',
      to_jsonb(_picker_group)
    );

    update public.estimator_template_constant_rows
    set values_json = _values
    where id = _row.id;

    -- Track touched orgs
    if not (_row.org_id = any(_touched_orgs)) then
      _touched_orgs := array_append(_touched_orgs, _row.org_id);
    end if;
  end loop;

  -- Bump template version for affected orgs
  if array_length(_touched_orgs, 1) > 0 then
    update public.estimator_template_constants t
    set version = greatest(1, coalesce(t.version, 0) + 1),
        updated_at = now()
    where t.org_id = any(_touched_orgs);
  end if;
end $$;
