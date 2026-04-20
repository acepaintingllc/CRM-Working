-- Add per-scope coat and spot-prime fields to estimate_room_wall_scopes.
-- These allow scope-level overrides of the global defaults stored in
-- estimate_jobsettings (walls_topcoats, wall_primer_coats, wall_spot_prime_pct).

alter table public.estimate_room_wall_scopes
  add column if not exists paint_coats       numeric null,
  add column if not exists primer_coats      numeric null,
  add column if not exists spot_prime_percent numeric null;
