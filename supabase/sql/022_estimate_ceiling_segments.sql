create table if not exists public.estimate_ceiling_segments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  position int not null default 0,
  room_id text null,
  seg_no int null,
  length_in numeric null,
  width_in numeric null,
  notes text null,
  active text not null default 'Y' check (active in ('Y', 'N')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists estimate_ceiling_segments_org_id_idx
  on public.estimate_ceiling_segments (org_id);
create index if not exists estimate_ceiling_segments_estimate_id_idx
  on public.estimate_ceiling_segments (org_id, estimate_id, position);
create index if not exists estimate_ceiling_segments_job_id_idx
  on public.estimate_ceiling_segments (org_id, job_id);

alter table public.estimate_ceiling_segments enable row level security;

drop trigger if exists trg_estimate_ceiling_segments_set_updated_at on public.estimate_ceiling_segments;
create trigger trg_estimate_ceiling_segments_set_updated_at
before update on public.estimate_ceiling_segments
for each row
execute function public.set_updated_at();

drop policy if exists "estimate_ceiling_segments_select" on public.estimate_ceiling_segments;
create policy "estimate_ceiling_segments_select"
  on public.estimate_ceiling_segments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_ceiling_segments.org_id
    )
  );

drop policy if exists "estimate_ceiling_segments_insert" on public.estimate_ceiling_segments;
create policy "estimate_ceiling_segments_insert"
  on public.estimate_ceiling_segments
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_ceiling_segments.org_id
    )
  );

drop policy if exists "estimate_ceiling_segments_update" on public.estimate_ceiling_segments;
create policy "estimate_ceiling_segments_update"
  on public.estimate_ceiling_segments
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_ceiling_segments.org_id
    )
  );

drop policy if exists "estimate_ceiling_segments_delete" on public.estimate_ceiling_segments;
create policy "estimate_ceiling_segments_delete"
  on public.estimate_ceiling_segments
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_ceiling_segments.org_id
    )
  );
