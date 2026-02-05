-- Run this in Supabase SQL Editor (or as a migration) to support Jobs + Google Calendar integration.
-- Requires extensions (gen_random_uuid) typically available via pgcrypto.

-- NOTE: If your project uses an enum for jobs.status, add/commit enum values first.
-- Run `supabase/sql/002a_job_status_enum.sql` in a separate Supabase SQL run before this file.

-- Jobs
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  title text not null,
  description text null,
  status public.job_status not null default 'estimate_scheduled',
  estimate_date timestamptz null,
  estimate_sent_at timestamptz null,
  scheduled_date timestamptz null,
  scheduled_end_date timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- If the table already existed from an earlier iteration, CREATE TABLE IF NOT EXISTS
-- won't add missing columns. These ALTERs make the migration idempotent.
alter table public.jobs add column if not exists title text;
alter table public.jobs add column if not exists description text;
alter table public.jobs add column if not exists status public.job_status;
alter table public.jobs add column if not exists estimate_date timestamptz;
alter table public.jobs add column if not exists estimate_sent_at timestamptz;
alter table public.jobs add column if not exists scheduled_date timestamptz;
alter table public.jobs add column if not exists scheduled_end_date timestamptz;
alter table public.jobs add column if not exists completed_at timestamptz;
alter table public.jobs add column if not exists created_at timestamptz;
alter table public.jobs add column if not exists updated_at timestamptz;

-- If status was created as a text column in an earlier iteration, try to convert it.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'jobs'
      and column_name = 'status'
      and udt_name <> 'job_status'
  ) then
    alter table public.jobs
      alter column status type public.job_status
      using status::public.job_status;
  end if;
exception
  when invalid_text_representation then
    -- If legacy rows have values not present in the enum, fall back to estimate_scheduled.
    update public.jobs set status = 'estimate_scheduled' where status is null;
    alter table public.jobs
      alter column status type public.job_status
      using 'estimate_scheduled'::public.job_status;
end
$$;

-- Backfill + enforce required fields (safe to re-run).
update public.jobs set title = 'Untitled job' where title is null;
alter table public.jobs alter column title set not null;
alter table public.jobs alter column status set default 'estimate_scheduled';
update public.jobs set status = 'estimate_scheduled' where status is null;
alter table public.jobs alter column created_at set default now();
alter table public.jobs alter column updated_at set default now();

create index if not exists jobs_org_id_idx on public.jobs(org_id);
create index if not exists jobs_customer_id_idx on public.jobs(customer_id);
create index if not exists jobs_status_idx on public.jobs(status);

-- Keep updated_at current
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_jobs_set_updated_at on public.jobs;
create trigger trg_jobs_set_updated_at
before update on public.jobs
for each row
execute function public.set_updated_at();

-- Google Calendar tokens
create table if not exists public.google_calendar_tokens (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null,
  access_token text not null,
  refresh_token text null,
  scope text null,
  token_type text null,
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id)
);

drop trigger if exists trg_google_calendar_tokens_set_updated_at on public.google_calendar_tokens;
create trigger trg_google_calendar_tokens_set_updated_at
before update on public.google_calendar_tokens
for each row
execute function public.set_updated_at();

-- NOTE:
-- If you have RLS enabled, you'll either need policies for these tables or keep using the server routes
-- (service-role key) like this repo does for customers/jobs.
