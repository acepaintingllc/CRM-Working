alter table public.estimate_jobsettings
  add column if not exists trim_paint_gallons numeric,
  add column if not exists trim_paint_quarts numeric;
