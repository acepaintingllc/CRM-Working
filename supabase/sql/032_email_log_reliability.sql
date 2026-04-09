create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  job_id uuid null references public.jobs(id) on delete set null,
  stage text not null,
  from_email text null,
  to_email text null,
  subject text null,
  body text null,
  idempotency_key text not null,
  status text not null default 'pending',
  error_message text null,
  gmail_message_id text null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  sent_at timestamptz null,
  constraint email_log_status_check
    check (status in ('pending', 'sent', 'failed', 'blocked'))
);

alter table public.email_log
  add column if not exists org_id uuid,
  add column if not exists job_id uuid,
  add column if not exists stage text,
  add column if not exists from_email text,
  add column if not exists to_email text,
  add column if not exists subject text,
  add column if not exists body text,
  add column if not exists idempotency_key text,
  add column if not exists status text,
  add column if not exists error_message text,
  add column if not exists gmail_message_id text,
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz,
  add column if not exists sent_at timestamptz;

update public.email_log
set
  idempotency_key = coalesce(idempotency_key, concat('legacy-', gen_random_uuid()::text)),
  status = coalesce(status, 'failed'),
  created_at = coalesce(created_at, now())
where idempotency_key is null
   or status is null
   or created_at is null;

with ranked as (
  select
    ctid,
    row_number() over (
      partition by org_id, idempotency_key
      order by created_at asc, ctid
    ) as rn
  from public.email_log
  where org_id is not null
)
update public.email_log as l
set idempotency_key = concat(l.idempotency_key, '-dedupe-', gen_random_uuid()::text)
from ranked
where l.ctid = ranked.ctid
  and ranked.rn > 1;

alter table public.email_log
  alter column idempotency_key set not null,
  alter column status set default 'pending',
  alter column status set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'email_log_status_check'
      and conrelid = 'public.email_log'::regclass
  ) then
    alter table public.email_log
      add constraint email_log_status_check
      check (status in ('pending', 'sent', 'failed', 'blocked'));
  end if;
end
$$;

create unique index if not exists email_log_org_idempotency_uniq
  on public.email_log (org_id, idempotency_key);

create index if not exists email_log_org_created_idx
  on public.email_log (org_id, created_at desc);

create index if not exists email_log_rate_limit_idx
  on public.email_log (org_id, created_by, job_id, stage, created_at desc);

alter table public.email_log enable row level security;

revoke all on table public.email_log from public;
revoke all on table public.email_log from anon;
revoke all on table public.email_log from authenticated;
grant select, insert, update, delete on table public.email_log to service_role;

drop policy if exists email_log_service_all on public.email_log;
create policy email_log_service_all
  on public.email_log
  for all
  to service_role
  using (true)
  with check (true);
