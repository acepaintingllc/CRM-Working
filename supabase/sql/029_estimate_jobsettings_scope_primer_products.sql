alter table public.estimate_jobsettings
  add column if not exists walls_primer_id text;

alter table public.estimate_jobsettings
  add column if not exists ceiling_primer_id text;

alter table public.estimate_jobsettings
  add column if not exists trim_primer_id text;
