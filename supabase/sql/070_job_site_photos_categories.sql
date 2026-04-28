-- Add category-aware Google Drive metadata for version-one job site photos.

alter table public.job_site_photos
  add column if not exists category text,
  add column if not exists job_drive_folder_id text null;

alter table public.job_site_photos
  alter column category set default 'after';

update public.job_site_photos
set category = 'after'
where category is null
  or category not in ('before', 'damage', 'after');

alter table public.job_site_photos
  alter column category set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_site_photos_category_check'
      and conrelid = 'public.job_site_photos'::regclass
  ) then
    alter table public.job_site_photos
      add constraint job_site_photos_category_check
      check (category in ('before', 'damage', 'after')) not valid;
  end if;
end $$;

alter table public.job_site_photos
  validate constraint job_site_photos_category_check;

create index if not exists job_site_photos_job_category_captured_at_idx
  on public.job_site_photos (org_id, job_id, category, captured_at desc, created_at desc);