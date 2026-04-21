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

create unique index if not exists customers_org_name_uniq
  on public.customers (org_id, lower(btrim(name)))
  where name is not null and btrim(name) <> '';

create unique index if not exists customers_org_email_uniq
  on public.customers (org_id, lower(btrim(email)))
  where email is not null and btrim(email) <> '';

create unique index if not exists customers_org_phone_uniq
  on public.customers (org_id, btrim(phone))
  where phone is not null and btrim(phone) <> '';
