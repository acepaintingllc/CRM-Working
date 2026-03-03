alter table public.estimate_segments
  add column if not exists wall_complexity_type_id text;

update public.estimate_segments
set wall_complexity_type_id = 'STANDARD'
where wall_complexity_type_id is null or trim(wall_complexity_type_id) = '';
