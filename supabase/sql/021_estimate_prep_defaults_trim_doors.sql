alter table public.estimate_jobsettings
  add column if not exists default_trim_prep_level text,
  add column if not exists default_doors_prep_level text;

alter table public.estimate_rooms
  add column if not exists doors_prep_override text;
