create table if not exists public.company_profile_settings (
  org_id uuid primary key references public.orgs(id) on delete cascade,
  business_name text not null default '',
  timezone text not null default 'America/Chicago',
  main_phone text not null default '',
  business_email text not null default '',
  address text not null default '',
  website text not null default '',
  sender_signature text not null default '',
  logo_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.company_profile_settings enable row level security;

drop trigger if exists trg_company_profile_settings_set_updated_at on public.company_profile_settings;
create trigger trg_company_profile_settings_set_updated_at
before update on public.company_profile_settings
for each row execute function public.set_updated_at();

drop policy if exists "company_profile_settings_select" on public.company_profile_settings;
create policy "company_profile_settings_select"
  on public.company_profile_settings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = company_profile_settings.org_id
    )
  );

drop policy if exists "company_profile_settings_write" on public.company_profile_settings;
create policy "company_profile_settings_write"
  on public.company_profile_settings
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = company_profile_settings.org_id
    )
  )
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = company_profile_settings.org_id
    )
  );

create table if not exists public.quote_send_defaults (
  org_id uuid primary key references public.orgs(id) on delete cascade,
  default_template_key text not null default 'default',
  quote_validity_days int not null default 90,
  terms_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.quote_send_defaults enable row level security;

drop trigger if exists trg_quote_send_defaults_set_updated_at on public.quote_send_defaults;
create trigger trg_quote_send_defaults_set_updated_at
before update on public.quote_send_defaults
for each row execute function public.set_updated_at();

drop policy if exists "quote_send_defaults_select" on public.quote_send_defaults;
create policy "quote_send_defaults_select"
  on public.quote_send_defaults
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = quote_send_defaults.org_id
    )
  );

drop policy if exists "quote_send_defaults_write" on public.quote_send_defaults;
create policy "quote_send_defaults_write"
  on public.quote_send_defaults
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = quote_send_defaults.org_id
    )
  )
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = quote_send_defaults.org_id
    )
  );

insert into public.quote_send_defaults (org_id, default_template_key, quote_validity_days, terms_text)
select
  org_id,
  coalesce(default_template_key, 'default'),
  coalesce(quote_validity_days, 90),
  coalesce(terms_text, '')
from public.estimate_template_settings
on conflict (org_id) do update
set
  default_template_key = excluded.default_template_key,
  quote_validity_days = excluded.quote_validity_days,
  terms_text = excluded.terms_text;

do $$
declare
  has_main_phone boolean;
  has_phone boolean;
  has_company_phone boolean;
  has_business_email boolean;
  has_email boolean;
  has_company_email boolean;
  has_from_email boolean;
  has_address boolean;
  has_company_address boolean;
  has_website boolean;
  has_company_website boolean;
  has_sender_signature boolean;
  has_default_sender_signature boolean;
  has_email_signature boolean;
  has_signature boolean;
  has_logo_url boolean;
  has_logo boolean;
  has_brand_logo_url boolean;
  sql text;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orgs' and column_name = 'main_phone'
  ) into has_main_phone;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orgs' and column_name = 'phone'
  ) into has_phone;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orgs' and column_name = 'company_phone'
  ) into has_company_phone;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orgs' and column_name = 'business_email'
  ) into has_business_email;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orgs' and column_name = 'email'
  ) into has_email;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orgs' and column_name = 'company_email'
  ) into has_company_email;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orgs' and column_name = 'from_email'
  ) into has_from_email;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orgs' and column_name = 'address'
  ) into has_address;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orgs' and column_name = 'company_address'
  ) into has_company_address;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orgs' and column_name = 'website'
  ) into has_website;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orgs' and column_name = 'company_website'
  ) into has_company_website;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orgs' and column_name = 'sender_signature'
  ) into has_sender_signature;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orgs' and column_name = 'default_sender_signature'
  ) into has_default_sender_signature;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orgs' and column_name = 'email_signature'
  ) into has_email_signature;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orgs' and column_name = 'signature'
  ) into has_signature;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orgs' and column_name = 'logo_url'
  ) into has_logo_url;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orgs' and column_name = 'logo'
  ) into has_logo;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orgs' and column_name = 'brand_logo_url'
  ) into has_brand_logo_url;

  sql := format(
    $query$
      insert into public.company_profile_settings (
        org_id,
        business_name,
        timezone,
        main_phone,
        business_email,
        address,
        website,
        sender_signature,
        logo_url
      )
      select
        id,
        coalesce(name, ''),
        coalesce(timezone, 'America/Chicago'),
        trim(coalesce(%1$s, '')),
        trim(coalesce(%2$s, '')),
        trim(coalesce(%3$s, '')),
        trim(coalesce(%4$s, '')),
        trim(coalesce(%5$s, '')),
        trim(coalesce(%6$s, ''))
      from public.orgs
      on conflict (org_id) do update
      set
        business_name = excluded.business_name,
        timezone = excluded.timezone,
        main_phone = excluded.main_phone,
        business_email = excluded.business_email,
        address = excluded.address,
        website = excluded.website,
        sender_signature = excluded.sender_signature,
        logo_url = excluded.logo_url
    $query$,
    case
      when has_main_phone then 'main_phone'
      when has_phone then 'phone'
      when has_company_phone then 'company_phone'
      else quote_literal('')
    end,
    case
      when has_business_email then 'business_email'
      when has_email then 'email'
      when has_company_email then 'company_email'
      when has_from_email then 'from_email'
      else quote_literal('')
    end,
    case
      when has_address then 'address'
      when has_company_address then 'company_address'
      else quote_literal('')
    end,
    case
      when has_website then 'website'
      when has_company_website then 'company_website'
      else quote_literal('')
    end,
    case
      when has_sender_signature then 'sender_signature'
      when has_default_sender_signature then 'default_sender_signature'
      when has_email_signature then 'email_signature'
      when has_signature then 'signature'
      else quote_literal('')
    end,
    case
      when has_logo_url then 'logo_url'
      when has_logo then 'logo'
      when has_brand_logo_url then 'brand_logo_url'
      else quote_literal('')
    end
  );

  execute sql;
end
$$;
