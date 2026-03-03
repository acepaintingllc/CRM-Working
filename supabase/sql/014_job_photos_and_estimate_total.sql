-- Store before/after job photos and cached estimate total for dashboard KPIs.

alter table public.jobs
  add column if not exists estimate_total_amount numeric null;

create table if not exists public.job_photos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  phase text not null check (phase in ('before', 'after')),
  url text not null,
  caption text null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_photos_org_id_idx
  on public.job_photos (org_id);

create index if not exists job_photos_job_id_idx
  on public.job_photos (org_id, job_id, phase, sort_order, created_at);

alter table public.job_photos enable row level security;

drop trigger if exists trg_job_photos_set_updated_at on public.job_photos;
create trigger trg_job_photos_set_updated_at
before update on public.job_photos
for each row
execute function public.set_updated_at();

create policy "job_photos_select"
  on public.job_photos
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_photos.org_id
    )
  );

create policy "job_photos_insert"
  on public.job_photos
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_photos.org_id
    )
  );

create policy "job_photos_update"
  on public.job_photos
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_photos.org_id
    )
  );

create policy "job_photos_delete"
  on public.job_photos
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_photos.org_id
    )
  );
