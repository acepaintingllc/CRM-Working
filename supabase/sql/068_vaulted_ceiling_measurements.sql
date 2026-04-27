alter table public.estimate_room_ceiling_scopes
  add column if not exists vaulted_ridge_length_in numeric null,
  add column if not exists vaulted_slope_length_in numeric null,
  add column if not exists vaulted_plane_count numeric null;
