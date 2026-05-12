alter table public.estimate_prejob
  add column if not exists room_id text null,
  add column if not exists trip_rate numeric null,
  add column if not exists manual_adjustment numeric null,
  add column if not exists calculated_total numeric null,
  add column if not exists effective_total numeric null;

create index if not exists estimate_prejob_room_id_idx
  on public.estimate_prejob (org_id, estimate_id, room_id)
  where active = 'Y';
