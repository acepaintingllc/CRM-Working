alter table public.estimate_room_trim_scopes
  add column if not exists baseboard_opening_count numeric null;
