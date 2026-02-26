alter table public.estimate_ceiling_segments
  add column if not exists ceiling_height_in numeric null;
