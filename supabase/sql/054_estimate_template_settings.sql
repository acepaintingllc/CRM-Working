create table if not exists public.estimate_template_settings (
  org_id uuid primary key references public.orgs(id) on delete cascade,
  default_template_key text not null default 'default',
  quote_validity_days int not null default 90,
  terms_text text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.estimate_template_settings enable row level security;

drop trigger if exists trg_estimate_template_settings_set_updated_at on public.estimate_template_settings;
create trigger trg_estimate_template_settings_set_updated_at
before update on public.estimate_template_settings
for each row execute function public.set_updated_at();

drop policy if exists "estimate_template_settings_select" on public.estimate_template_settings;
create policy "estimate_template_settings_select"
  on public.estimate_template_settings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_template_settings.org_id
    )
  );

drop policy if exists "estimate_template_settings_write" on public.estimate_template_settings;
create policy "estimate_template_settings_write"
  on public.estimate_template_settings
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_template_settings.org_id
    )
  )
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_template_settings.org_id
    )
  );
