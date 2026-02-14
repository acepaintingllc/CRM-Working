-- Store the linked simple wall estimate sheet per job
alter table public.job_simple_wall_estimates
  add column if not exists sheet_file_id text null,
  add column if not exists sheet_web_view_link text null,
  add column if not exists sheet_edit_url text null;
