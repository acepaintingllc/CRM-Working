alter table public.estimate_room_ceiling_scopes
  add column if not exists ceiling_geometry_mode text null,
  add column if not exists vaulted_area_factor numeric null,
  add column if not exists tray_perimeter_in numeric null,
  add column if not exists tray_step_height_in numeric null,
  add column if not exists tray_band_width_in numeric null,
  add column if not exists coffer_section_length_in numeric null,
  add column if not exists coffer_section_width_in numeric null,
  add column if not exists coffer_section_count numeric null,
  add column if not exists coffer_face_height_in numeric null,
  add column if not exists coffer_bottom_width_in numeric null,
  add column if not exists helper_extra_area_sf numeric null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'estimate_room_ceiling_scopes_geometry_mode_check'
  ) then
    alter table public.estimate_room_ceiling_scopes
      add constraint estimate_room_ceiling_scopes_geometry_mode_check
      check (ceiling_geometry_mode is null or ceiling_geometry_mode in ('FLAT', 'VAULTED', 'TRAY', 'COFFERED', 'MANUAL'));
  end if;
end $$;
