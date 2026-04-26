-- Adds room/scope condition selections and seeds the default condition modifier catalog.

alter table public.estimate_rooms
  add column if not exists condition_selections jsonb null;

alter table public.estimate_room_wall_scopes
  add column if not exists condition_selections jsonb null;

alter table public.estimate_room_ceiling_scopes
  add column if not exists condition_selections jsonb null;

alter table public.estimate_room_trim_scopes
  add column if not exists condition_selections jsonb null;

with templates as (
  select id as template_id, org_id
  from public.estimator_template_constants
),
canonical(row_id, display_name, scope, modifier_type, factor_field, levels, sort_order) as (
  values
    ('ROOM_FURNISHED', 'Room is furnished', 'room', 'binary', null, '{"active": 1.15}'::jsonb, 0),
    ('WALL_CUT_IN', 'Heavy cut-in areas', 'wall', 'severity', 'cut_in_factor', '{"minor": 1.10, "moderate": 1.20, "major": 1.35}'::jsonb, 10),
    ('WALL_TEXTURE', 'Heavy wall texture', 'wall', 'severity', 'complexity_factor', '{"minor": 1.10, "moderate": 1.20, "major": 1.30}'::jsonb, 20),
    ('CEIL_TEXTURE', 'Textured / popcorn ceiling', 'ceiling', 'severity', 'complexity_factor', '{"minor": 1.15, "moderate": 1.30, "major": 1.50}'::jsonb, 30),
    ('TRIM_OIL_BASED', 'Old oil-based paint', 'trim', 'binary', 'difficult_finish_factor', '{"active": 1.35}'::jsonb, 40),
    ('TRIM_CAULKING', 'Caulking needed', 'trim', 'severity', 'caulk_fill_factor', '{"minor": 1.10, "moderate": 1.25, "major": 1.50}'::jsonb, 50),
    ('TRIM_PREP', 'Heavy prep / sanding', 'trim', 'severity', 'prep_factor', '{"minor": 1.10, "moderate": 1.25, "major": 1.45}'::jsonb, 60),
    ('TRIM_PROFILE', 'Complex profile', 'trim', 'severity', 'profile_factor', '{"minor": 1.10, "moderate": 1.20, "major": 1.35}'::jsonb, 70),
    ('TRIM_STAIRS', 'Stair / step trim', 'trim', 'binary', 'stair_factor', '{"active": 1.20}'::jsonb, 80),
    ('TRIM_MASKING', 'Heavy masking needed', 'trim', 'severity', 'masking_factor', '{"minor": 1.10, "moderate": 1.20, "major": 1.35}'::jsonb, 90)
),
upserted as (
  insert into public.estimator_template_constant_rows as rows (
    org_id,
    template_id,
    category_key,
    row_id,
    display_name,
    active,
    sort_order,
    values_json
  )
  select
    t.org_id,
    t.template_id,
    'condition_modifiers',
    c.row_id,
    c.display_name,
    'Y',
    c.sort_order,
    jsonb_build_object(
      'id', c.row_id,
      'display_name', c.display_name,
      'scope', c.scope,
      'modifier_type', c.modifier_type,
      'factor_field', c.factor_field,
      'levels', c.levels
    )
  from templates t
  cross join canonical c
  on conflict (org_id, category_key, row_id) do update
  set
    template_id = excluded.template_id,
    display_name = excluded.display_name,
    active = excluded.active,
    sort_order = excluded.sort_order,
    values_json = excluded.values_json
  where
    rows.template_id is distinct from excluded.template_id
    or rows.display_name is distinct from excluded.display_name
    or rows.active is distinct from excluded.active
    or rows.sort_order is distinct from excluded.sort_order
    or rows.values_json is distinct from excluded.values_json
  returning rows.org_id
)
update public.estimator_template_constants t
set version = greatest(1, coalesce(t.version, 0) + 1),
    updated_at = now()
where t.org_id in (select distinct org_id from upserted);
