create table if not exists public.job_schedules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  notes text null,
  calendar_event_id text null,
  calendar_added_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists job_schedules_org_id_idx on public.job_schedules(org_id);
create index if not exists job_schedules_job_id_idx on public.job_schedules(job_id);

-- Idempotent adds if table existed
alter table public.job_schedules add column if not exists calendar_event_id text;
alter table public.job_schedules add column if not exists calendar_added_at timestamptz;
