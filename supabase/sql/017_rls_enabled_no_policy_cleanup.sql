-- Cleanup for Security Advisor warnings: "RLS Enabled No Policy"
-- For server-only tables, the safest default is:
--  - keep RLS enabled
--  - revoke privileges from anon/authenticated
--  - explicitly allow service_role (your API routes use SUPABASE_SERVICE_ROLE_KEY)

do $$
declare
  t text;
  p text;
begin
  foreach t in array ARRAY[
    'public.attachments',
    'public.calendar_events',
    'public.email_log',
    'public.email_templates',
    'public.integrations_google_tokens',
    'public.integrations_google_token',
    'public.job_status_history',
    'public.jobs',
    'public.org_members',
    'public.orgs',
    'public.properties'
  ]
  loop
    if to_regclass(t) is not null then
      p := split_part(t, '.', 2) || '_service_all';
      execute format('alter table %s enable row level security', t);

      execute format('revoke all on table %s from public', t);
      execute format('revoke all on table %s from anon', t);
      execute format('revoke all on table %s from authenticated', t);
      execute format('grant select, insert, update, delete on table %s to service_role', t);

      execute format('drop policy if exists %I on %s', p, t);
      execute format(
        'create policy %I on %s for all to service_role using (true) with check (true)',
        p,
        t
      );
    end if;
  end loop;
end
$$;
