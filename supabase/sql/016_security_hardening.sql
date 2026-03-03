-- Security hardening: RLS + sensitive data access controls

-- Harden common trigger helper function against search_path attacks
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Membership helper (used in policies/RPC): fixed search_path for safety.
create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.org_members m
    where m.user_id = auth.uid()
      and m.org_id = target_org
  );
$$;

revoke all on function public.is_org_member(uuid) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_member(uuid) to service_role;

-- Google OAuth tokens should be server-only (service role) since they contain secrets.
-- Keep the table in `public` schema but lock down privileges and enable RLS.
alter table public.google_calendar_tokens enable row level security;

revoke all on table public.google_calendar_tokens from public;
revoke all on table public.google_calendar_tokens from anon;
revoke all on table public.google_calendar_tokens from authenticated;

grant select, insert, update, delete on table public.google_calendar_tokens to service_role;

drop policy if exists "google_calendar_tokens_service_all" on public.google_calendar_tokens;
create policy "google_calendar_tokens_service_all"
  on public.google_calendar_tokens
  for all
  to service_role
  using (true)
  with check (true);

-- Job schedules should be accessible only to members of the org.
alter table public.job_schedules enable row level security;

drop policy if exists "job_schedules_select" on public.job_schedules;
create policy "job_schedules_select"
  on public.job_schedules
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_schedules.org_id
    )
  );

drop policy if exists "job_schedules_insert" on public.job_schedules;
create policy "job_schedules_insert"
  on public.job_schedules
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_schedules.org_id
    )
  );

drop policy if exists "job_schedules_update" on public.job_schedules;
create policy "job_schedules_update"
  on public.job_schedules
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_schedules.org_id
    )
  )
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_schedules.org_id
    )
  );

drop policy if exists "job_schedules_delete" on public.job_schedules;
create policy "job_schedules_delete"
  on public.job_schedules
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_schedules.org_id
    )
  );
