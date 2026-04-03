alter table public.jobs
  add column if not exists closeout_notes text;

create table if not exists public.job_paint_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  sort_order int not null default 0,
  where_used text null,
  paint_product text null,
  sheen text null,
  color text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_paint_logs_org_idx
  on public.job_paint_logs (org_id);

create index if not exists job_paint_logs_job_sort_idx
  on public.job_paint_logs (org_id, job_id, sort_order, created_at);

alter table public.job_paint_logs enable row level security;

drop trigger if exists trg_job_paint_logs_set_updated_at on public.job_paint_logs;
create trigger trg_job_paint_logs_set_updated_at
before update on public.job_paint_logs
for each row
execute function public.set_updated_at();

revoke all on table public.job_paint_logs from public;
revoke all on table public.job_paint_logs from anon;
revoke all on table public.job_paint_logs from authenticated;
grant select, insert, update, delete on table public.job_paint_logs to service_role;

drop policy if exists job_paint_logs_service_all on public.job_paint_logs;
create policy job_paint_logs_service_all
  on public.job_paint_logs
  for all
  to service_role
  using (true)
  with check (true);
