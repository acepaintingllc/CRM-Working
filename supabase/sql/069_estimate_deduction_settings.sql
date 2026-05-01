alter table public.estimate_template_settings
  add column if not exists standard_door_deduction_sf numeric not null default 21,
  add column if not exists standard_window_deduction_sf numeric not null default 15,
  add column if not exists baseboard_opening_deduction_lf numeric not null default 3;

alter table public.estimate_jobsettings
  add column if not exists standard_door_deduction_sf numeric null,
  add column if not exists standard_window_deduction_sf numeric null,
  add column if not exists baseboard_opening_deduction_lf numeric null;
