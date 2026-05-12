create table if not exists public.estimator_room_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active',
  template_data jsonb not null default '{}'::jsonb,
  snapshot_labels jsonb not null default '{}'::jsonb,
  source_estimate_id uuid references public.estimates(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint estimator_room_templates_status_check check (status in ('active', 'archived')),
  constraint estimator_room_templates_data_version_check check ((template_data ->> 'version') = '1')
);

create table if not exists public.estimator_job_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active',
  template_data jsonb not null default '{}'::jsonb,
  snapshot_labels jsonb not null default '{}'::jsonb,
  source_estimate_id uuid references public.estimates(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint estimator_job_templates_status_check check (status in ('active', 'archived')),
  constraint estimator_job_templates_data_version_check check ((template_data ->> 'version') = '1')
);

create index if not exists estimator_room_templates_org_status_name_idx
  on public.estimator_room_templates (org_id, status, lower(name));

create index if not exists estimator_job_templates_org_status_name_idx
  on public.estimator_job_templates (org_id, status, lower(name));

create index if not exists estimator_room_templates_source_estimate_idx
  on public.estimator_room_templates (source_estimate_id)
  where source_estimate_id is not null;

create index if not exists estimator_job_templates_source_estimate_idx
  on public.estimator_job_templates (source_estimate_id)
  where source_estimate_id is not null;

alter table public.estimator_room_templates enable row level security;
alter table public.estimator_job_templates enable row level security;

drop trigger if exists trg_estimator_room_templates_set_updated_at on public.estimator_room_templates;
create trigger trg_estimator_room_templates_set_updated_at
before update on public.estimator_room_templates
for each row execute function public.set_updated_at();

drop trigger if exists trg_estimator_job_templates_set_updated_at on public.estimator_job_templates;
create trigger trg_estimator_job_templates_set_updated_at
before update on public.estimator_job_templates
for each row execute function public.set_updated_at();

drop policy if exists "estimator_room_templates_select" on public.estimator_room_templates;
create policy "estimator_room_templates_select"
  on public.estimator_room_templates
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimator_room_templates.org_id
    )
  );

drop policy if exists "estimator_room_templates_write" on public.estimator_room_templates;
create policy "estimator_room_templates_write"
  on public.estimator_room_templates
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimator_room_templates.org_id
    )
  )
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimator_room_templates.org_id
    )
  );

drop policy if exists "estimator_job_templates_select" on public.estimator_job_templates;
create policy "estimator_job_templates_select"
  on public.estimator_job_templates
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimator_job_templates.org_id
    )
  );

drop policy if exists "estimator_job_templates_write" on public.estimator_job_templates;
create policy "estimator_job_templates_write"
  on public.estimator_job_templates
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimator_job_templates.org_id
    )
  )
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimator_job_templates.org_id
    )
  );
