-- Notes module (personal internal tasks + notes)

create table if not exists public.notes_folders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notes_folders_name_check check (length(trim(name)) > 0)
);

create unique index if not exists notes_folders_org_name_uniq
  on public.notes_folders (org_id, lower(name));

create index if not exists notes_folders_org_sort_idx
  on public.notes_folders (org_id, sort_order asc, created_at asc);

create table if not exists public.notes_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  title text not null,
  body text not null default '',
  folder_id uuid null references public.notes_folders(id) on delete set null,
  status text not null default 'active',
  starred boolean not null default false,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,
  constraint notes_notes_status_check check (status in ('active', 'archived'))
);

create index if not exists notes_notes_org_status_updated_idx
  on public.notes_notes (org_id, status, updated_at desc);

create index if not exists notes_notes_org_folder_idx
  on public.notes_notes (org_id, folder_id, updated_at desc);

create table if not exists public.notes_tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  title text not null,
  description text null,
  status text not null default 'active',
  due_at timestamptz null,
  is_all_day boolean not null default false,
  has_due_time boolean not null default false,
  reminder_enabled boolean not null default false,
  reminder_at timestamptz null,
  reminder_offset_minutes integer null,
  reminder_sent_at timestamptz null,
  recurrence_rule jsonb null,
  recurrence_series_id uuid null,
  priority text null,
  starred boolean not null default false,
  source_note_id uuid null references public.notes_notes(id) on delete set null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null,
  archived_at timestamptz null,
  constraint notes_tasks_status_check check (status in ('active', 'completed', 'archived')),
  constraint notes_tasks_priority_check check (priority is null or priority in ('low', 'medium', 'high'))
);

create index if not exists notes_tasks_org_status_due_idx
  on public.notes_tasks (org_id, status, due_at asc, created_at desc);

create index if not exists notes_tasks_org_reminder_idx
  on public.notes_tasks (org_id, reminder_enabled, reminder_at asc);

create index if not exists notes_tasks_org_series_idx
  on public.notes_tasks (org_id, recurrence_series_id, created_at asc);

create table if not exists public.notes_reminder_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  task_id uuid null references public.notes_tasks(id) on delete set null,
  reminder_type text not null,
  email_to text not null,
  scheduled_for timestamptz not null,
  sent_at timestamptz null,
  status text not null default 'pending',
  error_message text null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  constraint notes_reminder_logs_status_check check (status in ('pending', 'sent', 'failed', 'skipped')),
  constraint notes_reminder_logs_type_check check (
    reminder_type in ('daily_summary', 'single_task_reminder', 'recurring_task_reminder')
  )
);

create unique index if not exists notes_reminder_logs_org_idempotency_uniq
  on public.notes_reminder_logs (org_id, idempotency_key);

create index if not exists notes_reminder_logs_org_created_idx
  on public.notes_reminder_logs (org_id, created_at desc);

create index if not exists notes_reminder_logs_org_status_idx
  on public.notes_reminder_logs (org_id, status, scheduled_for asc);

create table if not exists public.notes_settings (
  org_id uuid primary key references public.orgs(id) on delete cascade,
  sender_user_id uuid null references auth.users(id) on delete set null,
  daily_summary_email_to text null,
  daily_summary_time_local text not null default '07:00',
  timezone text not null default 'America/Chicago',
  show_upcoming_days integer not null default 3,
  last_daily_summary_attempted_on date null,
  last_daily_summary_sent_on date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notes_settings_time_check check (daily_summary_time_local ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  constraint notes_settings_upcoming_days_check check (show_upcoming_days between 0 and 14)
);

drop trigger if exists trg_notes_folders_set_updated_at on public.notes_folders;
create trigger trg_notes_folders_set_updated_at
before update on public.notes_folders
for each row
execute function public.set_updated_at();

drop trigger if exists trg_notes_notes_set_updated_at on public.notes_notes;
create trigger trg_notes_notes_set_updated_at
before update on public.notes_notes
for each row
execute function public.set_updated_at();

drop trigger if exists trg_notes_tasks_set_updated_at on public.notes_tasks;
create trigger trg_notes_tasks_set_updated_at
before update on public.notes_tasks
for each row
execute function public.set_updated_at();

drop trigger if exists trg_notes_settings_set_updated_at on public.notes_settings;
create trigger trg_notes_settings_set_updated_at
before update on public.notes_settings
for each row
execute function public.set_updated_at();

alter table public.notes_folders enable row level security;
alter table public.notes_notes enable row level security;
alter table public.notes_tasks enable row level security;
alter table public.notes_reminder_logs enable row level security;
alter table public.notes_settings enable row level security;

revoke all on table public.notes_folders from public;
revoke all on table public.notes_folders from anon;
revoke all on table public.notes_folders from authenticated;
grant select, insert, update, delete on table public.notes_folders to service_role;

revoke all on table public.notes_notes from public;
revoke all on table public.notes_notes from anon;
revoke all on table public.notes_notes from authenticated;
grant select, insert, update, delete on table public.notes_notes to service_role;

revoke all on table public.notes_tasks from public;
revoke all on table public.notes_tasks from anon;
revoke all on table public.notes_tasks from authenticated;
grant select, insert, update, delete on table public.notes_tasks to service_role;

revoke all on table public.notes_reminder_logs from public;
revoke all on table public.notes_reminder_logs from anon;
revoke all on table public.notes_reminder_logs from authenticated;
grant select, insert, update, delete on table public.notes_reminder_logs to service_role;

revoke all on table public.notes_settings from public;
revoke all on table public.notes_settings from anon;
revoke all on table public.notes_settings from authenticated;
grant select, insert, update, delete on table public.notes_settings to service_role;

drop policy if exists notes_folders_service_all on public.notes_folders;
create policy notes_folders_service_all
  on public.notes_folders
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists notes_notes_service_all on public.notes_notes;
create policy notes_notes_service_all
  on public.notes_notes
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists notes_tasks_service_all on public.notes_tasks;
create policy notes_tasks_service_all
  on public.notes_tasks
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists notes_reminder_logs_service_all on public.notes_reminder_logs;
create policy notes_reminder_logs_service_all
  on public.notes_reminder_logs
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists notes_settings_service_all on public.notes_settings;
create policy notes_settings_service_all
  on public.notes_settings
  for all
  to service_role
  using (true)
  with check (true);
