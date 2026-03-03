alter table public.estimate_rooms
  add column if not exists ceiling_prep_level text;
