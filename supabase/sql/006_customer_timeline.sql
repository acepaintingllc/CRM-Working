-- Customer timeline events (notes, emails, status changes)
create table if not exists public.customer_timeline (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  created_by uuid null references auth.users(id),
  type text not null default 'note',
  title text null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists customer_timeline_org_id_idx
  on public.customer_timeline (org_id);
create index if not exists customer_timeline_customer_id_idx
  on public.customer_timeline (customer_id);
create index if not exists customer_timeline_created_at_idx
  on public.customer_timeline (created_at desc);

alter table public.customer_timeline enable row level security;

create policy "customer_timeline_select"
  on public.customer_timeline
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = customer_timeline.org_id
    )
  );

create policy "customer_timeline_insert"
  on public.customer_timeline
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = customer_timeline.org_id
    )
  );

create policy "customer_timeline_update"
  on public.customer_timeline
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = customer_timeline.org_id
    )
  );

create policy "customer_timeline_delete"
  on public.customer_timeline
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = customer_timeline.org_id
    )
  );
