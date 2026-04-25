-- Forward-fix migration for environments where 058/060 may already have run.
-- Ensures:
-- 1) duplicate preflight checks exist before customer uniqueness enforcement
-- 2) customer unique indexes are present
-- 3) quote_home_jobs_page enforces cursor integrity and a bounded p_limit over-fetch clamp

do $$
declare
  v_duplicate_name_groups jsonb;
  v_duplicate_email_groups jsonb;
  v_duplicate_phone_groups jsonb;
begin
  select jsonb_agg(
           jsonb_build_object(
             'org_id', d.org_id,
             'normalized_name', d.normalized_name,
             'count', d.duplicate_count
           )
         )
  into v_duplicate_name_groups
  from (
    select
      c.org_id,
      lower(btrim(c.name)) as normalized_name,
      count(*)::integer as duplicate_count
    from public.customers c
    where c.name is not null
      and btrim(c.name) <> ''
    group by c.org_id, lower(btrim(c.name))
    having count(*) > 1
    order by count(*) desc, c.org_id, lower(btrim(c.name))
    limit 20
  ) d;

  if v_duplicate_name_groups is not null then
    raise exception
      using
        errcode = '23505',
        message = 'Preflight failed: duplicate customer names exist for (org_id, lower(trim(name))).',
        detail = v_duplicate_name_groups::text,
        hint = 'Deduplicate customers for each listed org/key before re-running this migration.';
  end if;

  select jsonb_agg(
           jsonb_build_object(
             'org_id', d.org_id,
             'normalized_email', d.normalized_email,
             'count', d.duplicate_count
           )
         )
  into v_duplicate_email_groups
  from (
    select
      c.org_id,
      lower(btrim(c.email)) as normalized_email,
      count(*)::integer as duplicate_count
    from public.customers c
    where c.email is not null
      and btrim(c.email) <> ''
    group by c.org_id, lower(btrim(c.email))
    having count(*) > 1
    order by count(*) desc, c.org_id, lower(btrim(c.email))
    limit 20
  ) d;

  if v_duplicate_email_groups is not null then
    raise exception
      using
        errcode = '23505',
        message = 'Preflight failed: duplicate customer emails exist for (org_id, lower(trim(email))).',
        detail = v_duplicate_email_groups::text,
        hint = 'Deduplicate customers for each listed org/key before re-running this migration.';
  end if;

  select jsonb_agg(
           jsonb_build_object(
             'org_id', d.org_id,
             'normalized_phone', d.normalized_phone,
             'count', d.duplicate_count
           )
         )
  into v_duplicate_phone_groups
  from (
    select
      c.org_id,
      btrim(c.phone) as normalized_phone,
      count(*)::integer as duplicate_count
    from public.customers c
    where c.phone is not null
      and btrim(c.phone) <> ''
    group by c.org_id, btrim(c.phone)
    having count(*) > 1
    order by count(*) desc, c.org_id, btrim(c.phone)
    limit 20
  ) d;

  if v_duplicate_phone_groups is not null then
    raise exception
      using
        errcode = '23505',
        message = 'Preflight failed: duplicate customer phones exist for (org_id, trim(phone)).',
        detail = v_duplicate_phone_groups::text,
        hint = 'Deduplicate customers for each listed org/key before re-running this migration.';
  end if;
end;
$$;

create unique index if not exists customers_org_name_uniq
  on public.customers (org_id, lower(btrim(name)))
  where name is not null and btrim(name) <> '';

create unique index if not exists customers_org_email_uniq
  on public.customers (org_id, lower(btrim(email)))
  where email is not null and btrim(email) <> '';

create unique index if not exists customers_org_phone_uniq
  on public.customers (org_id, btrim(phone))
  where phone is not null and btrim(phone) <> '';

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
        j.status,
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
