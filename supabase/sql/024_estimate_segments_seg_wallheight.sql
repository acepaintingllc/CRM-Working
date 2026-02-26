alter table public.estimate_segments
  add column if not exists seg_wallheight_in numeric;
