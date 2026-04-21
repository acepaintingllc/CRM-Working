alter table public.estimate_template_settings
  add column if not exists labor_day_policy_enabled boolean not null default true,
  add column if not exists dayhours numeric not null default 8,
  add column if not exists rounding_increment_hours numeric not null default 4,
  add column if not exists override_labor_rate numeric not null default 40,
  add column if not exists job_minimum_enabled boolean not null default false,
  add column if not exists job_minimum_amount numeric not null default 0;
