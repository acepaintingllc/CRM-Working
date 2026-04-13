create table if not exists public.job_site_photos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  client_local_id text not null,
  drive_file_id text not null,
  drive_folder_id text null,
  url text not null,
  caption text null,
  created_by_user_id uuid null,
  captured_at timestamptz not null,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_site_photos_org_job_local_unique unique (org_id, job_id, client_local_id)
);

create index if not exists job_site_photos_org_id_idx
  on public.job_site_photos (org_id);

create index if not exists job_site_photos_job_id_captured_at_idx
  on public.job_site_photos (org_id, job_id, captured_at desc, created_at desc);

alter table public.job_site_photos enable row level security;

drop trigger if exists trg_job_site_photos_set_updated_at on public.job_site_photos;
create trigger trg_job_site_photos_set_updated_at
before update on public.job_site_photos
for each row
execute function public.set_updated_at();

create policy "job_site_photos_select"
  on public.job_site_photos
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_site_photos.org_id
    )
  );

create policy "job_site_photos_insert"
  on public.job_site_photos
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_site_photos.org_id
    )
  );

create policy "job_site_photos_update"
  on public.job_site_photos
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_site_photos.org_id
    )
  );

create policy "job_site_photos_delete"
  on public.job_site_photos
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = job_site_photos.org_id
    )
  );
