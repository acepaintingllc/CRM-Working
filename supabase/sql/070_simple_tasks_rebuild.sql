-- Simple tasks rebuild. Notes/folders/reminders are intentionally removed.

drop table if exists public.notes_reminder_logs;
drop table if exists public.notes_settings;
drop table if exists public.notes_tasks;
drop table if exists public.notes_notes;
drop table if exists public.notes_folders;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  title text not null,
  description text null,
  status text not null default 'open',
  due_at timestamptz null,
  customer_id uuid null references public.customers(id) on delete set null,
  job_id uuid null references public.jobs(id) on delete set null,
  estimate_id uuid null references public.estimates(id) on delete set null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null,
  constraint tasks_title_check check (length(trim(title)) > 0),
  constraint tasks_status_check check (status in ('open', 'done'))
);

create index if not exists tasks_org_status_due_idx
  on public.tasks (org_id, status, due_at asc, created_at desc);

create index if not exists tasks_org_customer_idx
  on public.tasks (org_id, customer_id)
  where customer_id is not null;

create index if not exists tasks_org_job_idx
  on public.tasks (org_id, job_id)
  where job_id is not null;

create index if not exists tasks_org_estimate_idx
  on public.tasks (org_id, estimate_id)
  where estimate_id is not null;

drop trigger if exists trg_tasks_set_updated_at on public.tasks;
create trigger trg_tasks_set_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

alter table public.tasks enable row level security;

revoke all on table public.tasks from public;
revoke all on table public.tasks from anon;
revoke all on table public.tasks from authenticated;
grant select, insert, update, delete on table public.tasks to service_role;

drop policy if exists tasks_service_all on public.tasks;
create policy tasks_service_all
  on public.tasks
  for all
  to service_role
  using (true)
  with check (true);
