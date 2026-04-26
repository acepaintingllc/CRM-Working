-- Quote home read-model support.
-- Adds bounded server-side functions for:
-- 1) org-scoped quote-home KPI aggregation
-- 2) paged quote-home job browsing with version counts

alter table public.jobs
  add column if not exists scheduled_email_sent_at timestamptz;

alter table public.jobs
  add column if not exists completed_email_sent_at timestamptz;

alter table public.jobs
  add column if not exists closeout_notes text;

alter table public.jobs
  add column if not exists linked_estimate_id uuid;

create or replace function public.quote_home_summary(
  p_org_id uuid
) returns table (
  total_versions bigint,
  draft_count bigint,
  sent_or_awaiting_count bigint,
  live_count bigint,
  pipeline_total numeric
)
language sql
stable
set search_path = public
as $$
  with estimate_base as (
    select
      e.id,
      e.job_id,
      coalesce(nullif(btrim(e.version_state), ''), 'draft') as version_state
    from public.estimates e
    where e.org_id = p_org_id
  ),
  sent_jobs as (
    select j.id
    from public.jobs j
    where j.org_id = p_org_id
      and j.status in ('estimate_sent', 'follow_up')
  ),
  rollups as (
    select r.estimate_id, coalesce(r.final_total, 0) as final_total
    from public.estimate_version_rollups r
    where r.org_id = p_org_id
  )
  select
    count(*)::bigint as total_versions,
    count(*) filter (where estimate_base.version_state = 'draft')::bigint as draft_count,
    count(*) filter (where estimate_base.job_id in (select id from sent_jobs))::bigint as sent_or_awaiting_count,
    count(*) filter (where estimate_base.version_state = 'live')::bigint as live_count,
    coalesce(
      sum(
        case
          when estimate_base.version_state = 'archived' then 0
          else coalesce(rollups.final_total, 0)
        end
      ),
      0
    ) as pipeline_total
  from estimate_base
  left join rollups on rollups.estimate_id = estimate_base.id;
$$;

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
        c.name as customer_name,
        c.address as customer_address,
        j.title,
        j.description,
        j.status::text as status,
        j.created_at,
        j.estimate_date,
        j.estimate_sent_at,
        j.scheduled_date,
        j.scheduled_end_date,
        j.scheduled_email_sent_at,
        j.completed_at,
        j.completed_email_sent_at,
        j.closeout_notes,
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
      limit least(greatest(coalesce(p_limit, 25), 1), 100)
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

revoke all on function public.quote_home_summary(uuid) from public;
revoke all on function public.quote_home_summary(uuid) from anon;
revoke all on function public.quote_home_summary(uuid) from authenticated;
grant execute on function public.quote_home_summary(uuid) to service_role;

revoke all on function public.quote_home_jobs_page(uuid, text, integer, timestamptz, uuid) from public;
revoke all on function public.quote_home_jobs_page(uuid, text, integer, timestamptz, uuid) from anon;
revoke all on function public.quote_home_jobs_page(uuid, text, integer, timestamptz, uuid) from authenticated;
grant execute on function public.quote_home_jobs_page(uuid, text, integer, timestamptz, uuid) to service_role;
