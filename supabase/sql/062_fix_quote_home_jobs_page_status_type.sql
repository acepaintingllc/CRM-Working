-- Forward-fix quote_home_jobs_page for databases that already applied 061.
-- RETURN QUERY requires exact column types. Older databases may have text-like
-- columns as varchar, and jobs.status is public.job_status, while the RPC
-- contract returns text for the application read model.

create or replace function public.quote_home_jobs_page(
  p_org_id uuid,
  p_search text default null,
  p_limit integer default 25,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null
) returns table (
  id uuid,
  customer_id uuid,
  customer_name text,
  customer_address text,
  title text,
  description text,
  status text,
  created_at timestamptz,
  estimate_date timestamptz,
  estimate_sent_at timestamptz,
  scheduled_date timestamptz,
  scheduled_end_date timestamptz,
  scheduled_email_sent_at timestamptz,
  completed_at timestamptz,
  completed_email_sent_at timestamptz,
  closeout_notes text,
  linked_estimate_id uuid,
  version_count bigint
)
language plpgsql
stable
set search_path = public
as $$
begin
  if (p_cursor_created_at is null) <> (p_cursor_id is null) then
    raise exception
      using
        errcode = '22023',
        message = 'Invalid cursor: p_cursor_created_at and p_cursor_id must be provided together.';
  end if;

  return query
    with filtered_jobs as (
      select
        j.id,
        j.customer_id,
        c.name::text as customer_name,
        c.address::text as customer_address,
        j.title::text as title,
        j.description::text as description,
        j.status::text as status,
        j.created_at,
        j.estimate_date,
        j.estimate_sent_at,
        j.scheduled_date,
        j.scheduled_end_date,
        j.scheduled_email_sent_at,
        j.completed_at,
        j.completed_email_sent_at,
        j.closeout_notes::text as closeout_notes,
        j.linked_estimate_id
      from public.jobs j
      join public.customers c
        on c.org_id = p_org_id
       and c.id = j.customer_id
      where j.org_id = p_org_id
        and (
          nullif(btrim(coalesce(p_search, '')), '') is null
          or coalesce(j.title, '') ilike '%' || btrim(p_search) || '%'
          or coalesce(c.name, '') ilike '%' || btrim(p_search) || '%'
          or coalesce(c.address, '') ilike '%' || btrim(p_search) || '%'
        )
        and (
          p_cursor_created_at is null
          or (j.created_at, j.id) < (p_cursor_created_at, p_cursor_id)
        )
      order by j.created_at desc, j.id desc
      limit least(greatest(coalesce(p_limit, 25), 1), 101)
    ),
    version_counts as (
      select e.job_id, count(*)::bigint as version_count
      from public.estimates e
      where e.org_id = p_org_id
        and e.job_id in (select filtered_jobs.id from filtered_jobs)
      group by e.job_id
    )
    select
      filtered_jobs.id,
      filtered_jobs.customer_id,
      filtered_jobs.customer_name,
      filtered_jobs.customer_address,
      filtered_jobs.title,
      filtered_jobs.description,
      filtered_jobs.status,
      filtered_jobs.created_at,
      filtered_jobs.estimate_date,
      filtered_jobs.estimate_sent_at,
      filtered_jobs.scheduled_date,
      filtered_jobs.scheduled_end_date,
      filtered_jobs.scheduled_email_sent_at,
      filtered_jobs.completed_at,
      filtered_jobs.completed_email_sent_at,
      filtered_jobs.closeout_notes,
      filtered_jobs.linked_estimate_id,
      coalesce(version_counts.version_count, 0) as version_count
    from filtered_jobs
    left join version_counts on version_counts.job_id = filtered_jobs.id
    order by filtered_jobs.created_at desc, filtered_jobs.id desc;
end;
$$;

revoke all on function public.quote_home_jobs_page(uuid, text, integer, timestamptz, uuid) from public;
revoke all on function public.quote_home_jobs_page(uuid, text, integer, timestamptz, uuid) from anon;
revoke all on function public.quote_home_jobs_page(uuid, text, integer, timestamptz, uuid) from authenticated;
grant execute on function public.quote_home_jobs_page(uuid, text, integer, timestamptz, uuid) to service_role;
