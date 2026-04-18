-- Backfill legacy job_photos rows into canonical job_site_photos.
-- This migration only backfills rows where a Google Drive file id can be parsed.

with legacy_rows as (
  select
    jp.id as legacy_id,
    jp.org_id,
    jp.job_id,
    jp.url,
    jp.caption,
    jp.created_at,
    coalesce(
      nullif(substring(jp.url from '/d/([A-Za-z0-9_-]{20,})'), ''),
      nullif(substring(jp.url from '[?&]id=([A-Za-z0-9_-]{20,})'), ''),
      nullif(substring(jp.url from '^([A-Za-z0-9_-]{20,})$'), '')
    ) as parsed_drive_file_id
  from public.job_photos jp
  where jp.phase = 'after'
),
insertable as (
  select
    org_id,
    job_id,
    ('legacy-job-photo-' || legacy_id::text) as client_local_id,
    parsed_drive_file_id as drive_file_id,
    null::text as drive_folder_id,
    url,
    caption,
    null::uuid as created_by_user_id,
    coalesce(created_at, now()) as captured_at,
    now() as uploaded_at
  from legacy_rows
  where parsed_drive_file_id is not null
)
insert into public.job_site_photos (
  org_id,
  job_id,
  client_local_id,
  drive_file_id,
  drive_folder_id,
  url,
  caption,
  created_by_user_id,
  captured_at,
  uploaded_at
)
select
  org_id,
  job_id,
  client_local_id,
  drive_file_id,
  drive_folder_id,
  url,
  caption,
  created_by_user_id,
  captured_at,
  uploaded_at
from insertable
on conflict (org_id, job_id, client_local_id) do nothing;

create or replace view public.v_job_photo_backfill_report as
with legacy_rows as (
  select
    jp.id as legacy_id,
    jp.org_id,
    jp.job_id,
    jp.phase,
    jp.url,
    coalesce(
      nullif(substring(jp.url from '/d/([A-Za-z0-9_-]{20,})'), ''),
      nullif(substring(jp.url from '[?&]id=([A-Za-z0-9_-]{20,})'), ''),
      nullif(substring(jp.url from '^([A-Za-z0-9_-]{20,})$'), '')
    ) as parsed_drive_file_id
  from public.job_photos jp
),
mapped as (
  select
    l.*,
    exists (
      select 1
      from public.job_site_photos sp
      where sp.org_id = l.org_id
        and sp.job_id = l.job_id
        and sp.client_local_id = ('legacy-job-photo-' || l.legacy_id::text)
    ) as migrated
  from legacy_rows l
  where l.phase = 'after'
)
select
  org_id,
  job_id,
  count(*) as total_after_photos,
  count(*) filter (where parsed_drive_file_id is null) as missing_drive_id_count,
  count(*) filter (where migrated) as migrated_count,
  count(*) filter (where not migrated and parsed_drive_file_id is not null) as pending_migration_count
from mapped
group by org_id, job_id;

