update public.customers
set
  name = btrim(name),
  email = nullif(lower(btrim(email)), ''),
  phone = nullif(btrim(phone), ''),
  street = nullif(btrim(street), ''),
  city = nullif(btrim(city), ''),
  state = nullif(btrim(state), ''),
  zip = nullif(btrim(zip), ''),
  address = nullif(btrim(address), ''),
  notes = nullif(btrim(notes), '')
where
  name is distinct from btrim(name)
  or email is distinct from nullif(lower(btrim(email)), '')
  or phone is distinct from nullif(btrim(phone), '')
  or street is distinct from nullif(btrim(street), '')
  or city is distinct from nullif(btrim(city), '')
  or state is distinct from nullif(btrim(state), '')
  or zip is distinct from nullif(btrim(zip), '')
  or address is distinct from nullif(btrim(address), '')
  or notes is distinct from nullif(btrim(notes), '');

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
