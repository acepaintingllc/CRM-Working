-- Run this FIRST (as its own SQL run) in Supabase SQL Editor.
-- Postgres requires enum values to be committed before they can be used elsewhere.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'job_status') then
    create type public.job_status as enum (
      'estimate_scheduled',
      'estimate_sent',
      'scheduled',
      'completed'
    );
  end if;
end
$$;

alter type public.job_status add value if not exists 'estimate_scheduled';
alter type public.job_status add value if not exists 'estimate_sent';
alter type public.job_status add value if not exists 'scheduled';
alter type public.job_status add value if not exists 'completed';

