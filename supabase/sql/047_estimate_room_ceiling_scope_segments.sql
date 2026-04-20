-- v2 ceiling scope segments: used only when a ceiling scope is in SEG mode.
-- Mirrors estimate_segments (wall segments) but omits door/window deduction
-- columns — ceilings have no opening deductions in v1.

create table if not exists public.estimate_room_ceiling_scope_segments (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.orgs(id) on delete cascade,
  estimate_id      uuid not null references public.estimates(id) on delete cascade,
  job_id           uuid not null references public.jobs(id) on delete cascade,
  ceiling_scope_id uuid not null references public.estimate_room_ceiling_scopes(id) on delete cascade,
  room_id          text not null,
  position         int  not null default 0,
  segment_name     text null,
  include          text not null default 'Y' check (include in ('Y', 'N')),
  shape_type       text not null default 'RECTANGLE'
                     check (shape_type in ('RECTANGLE', 'TRIANGLE', 'MANUAL')),
  quantity         numeric not null default 1,
  -- RECTANGLE
  width_in         numeric null,
  height_in        numeric null,
  -- TRIANGLE
  base_in          numeric null,
  -- MANUAL
  manual_area_sf   numeric null,
  -- computed outputs
  raw_area_sf      numeric null,
  override_area_sf numeric null,
  effective_area_sf numeric null,
  notes            text null,
  active           text not null default 'Y' check (active in ('Y', 'N')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists estimate_room_ceiling_scope_segments_org_idx
  on public.estimate_room_ceiling_scope_segments (org_id);
create index if not exists estimate_room_ceiling_scope_segments_estimate_idx
  on public.estimate_room_ceiling_scope_segments (org_id, estimate_id);
create index if not exists estimate_room_ceiling_scope_segments_scope_idx
  on public.estimate_room_ceiling_scope_segments (ceiling_scope_id, position);

alter table public.estimate_room_ceiling_scope_segments enable row level security;

drop trigger if exists trg_estimate_room_ceiling_scope_segments_set_updated_at
  on public.estimate_room_ceiling_scope_segments;
create trigger trg_estimate_room_ceiling_scope_segments_set_updated_at
  before update on public.estimate_room_ceiling_scope_segments
  for each row execute function public.set_updated_at();

drop policy if exists "estimate_room_ceiling_scope_segments_select"
  on public.estimate_room_ceiling_scope_segments;
create policy "estimate_room_ceiling_scope_segments_select"
  on public.estimate_room_ceiling_scope_segments for select to authenticated
  using (
    exists (
      select 1 from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_room_ceiling_scope_segments.org_id
    )
  );

drop policy if exists "estimate_room_ceiling_scope_segments_insert"
  on public.estimate_room_ceiling_scope_segments;
create policy "estimate_room_ceiling_scope_segments_insert"
  on public.estimate_room_ceiling_scope_segments for insert to authenticated
  with check (
    exists (
      select 1 from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_room_ceiling_scope_segments.org_id
    )
  );

drop policy if exists "estimate_room_ceiling_scope_segments_update"
  on public.estimate_room_ceiling_scope_segments;
create policy "estimate_room_ceiling_scope_segments_update"
  on public.estimate_room_ceiling_scope_segments for update to authenticated
  using (
    exists (
      select 1 from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_room_ceiling_scope_segments.org_id
    )
  );

drop policy if exists "estimate_room_ceiling_scope_segments_delete"
  on public.estimate_room_ceiling_scope_segments;
create policy "estimate_room_ceiling_scope_segments_delete"
  on public.estimate_room_ceiling_scope_segments for delete to authenticated
  using (
    exists (
      select 1 from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_room_ceiling_scope_segments.org_id
    )
  );
