-- Estimate workbook v5 input fields (additive migration)

alter table public.estimate_rooms
  add column if not exists walls_prep_level text,
  add column if not exists wall_sqft_override numeric,
  add column if not exists openings_sqft numeric,
  add column if not exists walls_notes text;

alter table public.estimate_jobsettings
  add column if not exists trim_paint_qty numeric,
  add column if not exists trim_paint_uom text,
  add column if not exists trim_primer_qty numeric,
  add column if not exists trim_primer_uom text,
  add column if not exists walls_color_count numeric;

alter table public.estimate_prejob
  add column if not exists trip_num numeric,
  add column if not exists rollup_scope text,
  add column if not exists man_trip_name text,
  add column if not exists man_qty numeric,
  add column if not exists man_hours_each numeric,
  add column if not exists task text,
  add column if not exists extra_supplies numeric;
