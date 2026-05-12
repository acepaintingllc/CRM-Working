-- Post-acceptance operations schema foundation.
-- These tables store operational records derived from an accepted estimate
-- without mutating estimate or immutable estimate_snapshot rows.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'estimate_snapshot_identity_scope_uniq'
      and conrelid = 'public.estimate_snapshot'::regclass
  ) then
    alter table public.estimate_snapshot
      add constraint estimate_snapshot_identity_scope_uniq
      unique (id, org_id, job_id, estimate_id);
  end if;
end;
$$;

create table if not exists public.paint_brands (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete restrict,
  name text not null,
  display_name text not null,
  external_ref text null,
  status text not null default 'active'
    check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  unique (id, org_id),
  unique (org_id, name)
);

create table if not exists public.paint_sheens (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete restrict,
  name text not null,
  display_name text not null,
  sort_order integer not null default 0,
  status text not null default 'active'
    check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  unique (id, org_id),
  unique (org_id, name)
);

create table if not exists public.paint_color_catalog (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete restrict,
  brand_id uuid null references public.paint_brands(id) on delete restrict,
  brand_display_name text null,
  color_number text null,
  color_name text not null,
  display_name text not null,
  hex_color text null,
  collection_name text null,
  external_ref text null,
  status text not null default 'active'
    check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  unique (id, org_id),
  constraint paint_color_catalog_brand_scope_fkey
    foreign key (brand_id, org_id)
    references public.paint_brands (id, org_id)
    on delete restrict
);

create table if not exists public.paint_product_sheen_options (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete restrict,
  paint_product_id text not null,
  paint_product_display_name text not null,
  sheen_id uuid not null references public.paint_sheens(id) on delete restrict,
  sheen_display_name text not null,
  status text not null default 'active'
    check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint paint_product_sheen_options_sheen_scope_fkey
    foreign key (sheen_id, org_id)
    references public.paint_sheens (id, org_id)
    on delete restrict,
  unique (org_id, paint_product_id, sheen_id)
);

create table if not exists public.job_color_selection_sets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete restrict,
  job_id uuid not null references public.jobs(id) on delete restrict,
  estimate_id uuid not null references public.estimates(id) on delete restrict,
  estimate_snapshot_id uuid not null references public.estimate_snapshot(id) on delete restrict,
  customer_id uuid null references public.customers(id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'customer_open', 'submitted', 'confirmed', 'locked', 'voided')),
  revision_number integer not null default 1 check (revision_number > 0),
  title text not null default 'Color selections',
  accepted_estimate_display_name text null,
  accepted_total numeric not null default 0,
  public_token_hash text null,
  public_token_expires_at timestamptz null,
  public_token_revoked_at timestamptz null,
  submitted_at timestamptz null,
  confirmed_at timestamptz null,
  locked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint job_color_selection_sets_snapshot_scope_fkey
    foreign key (estimate_snapshot_id, org_id, job_id, estimate_id)
    references public.estimate_snapshot (id, org_id, job_id, estimate_id)
    on delete restrict,
  constraint job_color_selection_sets_token_boundary_check
    check (
      status <> 'customer_open'
      or (
        public_token_hash is not null
        and public_token_expires_at is not null
        and public_token_revoked_at is null
      )
    ),
  unique (org_id, job_id, estimate_snapshot_id, revision_number),
  unique (id, org_id),
  unique (id, org_id, job_id, estimate_id, estimate_snapshot_id)
);

create table if not exists public.job_color_selections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete restrict,
  job_id uuid not null references public.jobs(id) on delete restrict,
  estimate_id uuid not null references public.estimates(id) on delete restrict,
  estimate_snapshot_id uuid not null references public.estimate_snapshot(id) on delete restrict,
  selection_set_id uuid not null references public.job_color_selection_sets(id) on delete cascade,
  room_id text null,
  room_display_name text null,
  scope_kind text not null
    check (scope_kind in ('walls', 'ceilings', 'trim', 'doors', 'drywall', 'cabinets', 'other')),
  scope_id text null,
  scope_display_name text null,
  surface_label text null,
  paint_brand_id uuid null references public.paint_brands(id) on delete restrict,
  paint_brand_display_name text null,
  color_catalog_id uuid null references public.paint_color_catalog(id) on delete restrict,
  color_number text null,
  color_name text null,
  color_display_name text null,
  sheen_id uuid null references public.paint_sheens(id) on delete restrict,
  sheen_display_name text null,
  paint_product_id text null,
  paint_product_display_name text null,
  quantity_label text null,
  notes text null,
  customer_notes text null,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'confirmed', 'locked', 'voided')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint job_color_selections_set_scope_fkey
    foreign key (selection_set_id, org_id, job_id, estimate_id, estimate_snapshot_id)
    references public.job_color_selection_sets (id, org_id, job_id, estimate_id, estimate_snapshot_id)
    on delete cascade,
  constraint job_color_selections_snapshot_scope_fkey
    foreign key (estimate_snapshot_id, org_id, job_id, estimate_id)
    references public.estimate_snapshot (id, org_id, job_id, estimate_id)
    on delete restrict,
  constraint job_color_selections_brand_scope_fkey
    foreign key (paint_brand_id, org_id)
    references public.paint_brands (id, org_id)
    on delete restrict,
  constraint job_color_selections_color_scope_fkey
    foreign key (color_catalog_id, org_id)
    references public.paint_color_catalog (id, org_id)
    on delete restrict,
  constraint job_color_selections_sheen_scope_fkey
    foreign key (sheen_id, org_id)
    references public.paint_sheens (id, org_id)
    on delete restrict
);

create table if not exists public.job_work_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete restrict,
  job_id uuid not null references public.jobs(id) on delete restrict,
  estimate_id uuid not null references public.estimates(id) on delete restrict,
  estimate_snapshot_id uuid not null references public.estimate_snapshot(id) on delete restrict,
  color_selection_set_id uuid null references public.job_color_selection_sets(id) on delete restrict,
  revision_number integer not null default 1 check (revision_number > 0),
  status text not null default 'draft'
    check (status in ('draft', 'issued', 'superseded', 'voided')),
  title text not null default 'Work order',
  work_order_number text null,
  accepted_estimate_display_name text null,
  customer_display_name text null,
  job_display_name text null,
  accepted_total numeric not null default 0,
  change_order_total numeric not null default 0,
  work_order_total numeric not null default 0,
  generated_snapshot_json jsonb not null default '{}'::jsonb,
  source_summary_json jsonb not null default '{}'::jsonb,
  issued_at timestamptz null,
  superseded_at timestamptz null,
  voided_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint job_work_orders_snapshot_scope_fkey
    foreign key (estimate_snapshot_id, org_id, job_id, estimate_id)
    references public.estimate_snapshot (id, org_id, job_id, estimate_id)
    on delete restrict,
  unique (org_id, job_id, estimate_snapshot_id, revision_number)
);

create table if not exists public.job_invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete restrict,
  job_id uuid not null references public.jobs(id) on delete restrict,
  estimate_id uuid not null references public.estimates(id) on delete restrict,
  estimate_snapshot_id uuid not null references public.estimate_snapshot(id) on delete restrict,
  invoice_number text null,
  revision_number integer not null default 1 check (revision_number > 0),
  status text not null default 'draft'
    check (status in ('draft', 'issued', 'partially_paid', 'paid', 'voided', 'superseded')),
  title text not null default 'Invoice',
  accepted_estimate_display_name text null,
  customer_display_name text null,
  job_display_name text null,
  accepted_quote_total numeric not null default 0,
  accepted_change_order_total numeric not null default 0,
  payment_total numeric not null default 0,
  credit_total numeric not null default 0,
  invoice_total numeric not null default 0,
  balance_due numeric not null default 0,
  generated_snapshot_json jsonb not null default '{}'::jsonb,
  source_summary_json jsonb not null default '{}'::jsonb,
  issued_at timestamptz null,
  due_at timestamptz null,
  paid_at timestamptz null,
  voided_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint job_invoices_snapshot_scope_fkey
    foreign key (estimate_snapshot_id, org_id, job_id, estimate_id)
    references public.estimate_snapshot (id, org_id, job_id, estimate_id)
    on delete restrict,
  constraint job_invoices_nonnegative_totals_check
    check (
      accepted_quote_total >= 0
      and payment_total >= 0
      and credit_total >= 0
      and invoice_total >= 0
    ),
  unique (org_id, job_id, estimate_snapshot_id, revision_number)
);

create table if not exists public.job_change_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete restrict,
  job_id uuid not null references public.jobs(id) on delete restrict,
  estimate_id uuid not null references public.estimates(id) on delete restrict,
  estimate_snapshot_id uuid not null references public.estimate_snapshot(id) on delete restrict,
  change_order_number text null,
  revision_number integer not null default 1 check (revision_number > 0),
  status text not null default 'draft'
    check (status in ('draft', 'issued', 'pending_customer_acceptance', 'accepted', 'rejected', 'cancelled', 'voided')),
  title text not null default 'Change order',
  description text null,
  accepted_estimate_display_name text null,
  customer_display_name text null,
  job_display_name text null,
  delta_total numeric not null default 0,
  generated_snapshot_json jsonb not null default '{}'::jsonb,
  source_summary_json jsonb not null default '{}'::jsonb,
  public_token_hash text null,
  public_token_expires_at timestamptz null,
  public_token_revoked_at timestamptz null,
  issued_at timestamptz null,
  accepted_at timestamptz null,
  rejected_at timestamptz null,
  cancelled_at timestamptz null,
  voided_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint job_change_orders_snapshot_scope_fkey
    foreign key (estimate_snapshot_id, org_id, job_id, estimate_id)
    references public.estimate_snapshot (id, org_id, job_id, estimate_id)
    on delete restrict,
  constraint job_change_orders_token_boundary_check
    check (
      status <> 'pending_customer_acceptance'
      or (
        public_token_hash is not null
        and public_token_expires_at is not null
        and public_token_revoked_at is null
      )
    ),
  unique (org_id, job_id, estimate_snapshot_id, revision_number)
);

create table if not exists public.job_operations_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete restrict,
  job_id uuid not null references public.jobs(id) on delete restrict,
  estimate_id uuid null references public.estimates(id) on delete restrict,
  estimate_snapshot_id uuid null references public.estimate_snapshot(id) on delete restrict,
  event_type text not null,
  actor_type text not null default 'staff'
    check (actor_type in ('staff', 'customer', 'system')),
  actor_user_id uuid null references auth.users(id) on delete set null,
  customer_token_hash text null,
  related_table text null
    check (
      related_table is null
      or related_table in (
        'job_color_selection_sets',
        'job_color_selections',
        'job_work_orders',
        'job_invoices',
        'job_change_orders'
      )
    ),
  related_id uuid null,
  display_title text null,
  display_total numeric null,
  event_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint job_operations_events_snapshot_requires_estimate_check
    check (estimate_snapshot_id is null or estimate_id is not null),
  constraint job_operations_events_snapshot_scope_fkey
    foreign key (estimate_snapshot_id, org_id, job_id, estimate_id)
    references public.estimate_snapshot (id, org_id, job_id, estimate_id)
    on delete restrict
);

create index if not exists paint_color_catalog_org_brand_idx
  on public.paint_color_catalog (org_id, brand_id, color_name);

create index if not exists paint_color_catalog_org_number_idx
  on public.paint_color_catalog (org_id, color_number)
  where color_number is not null;

create index if not exists paint_product_sheen_options_org_product_idx
  on public.paint_product_sheen_options (org_id, paint_product_id);

create index if not exists job_color_selection_sets_org_job_idx
  on public.job_color_selection_sets (org_id, job_id, updated_at desc);

create index if not exists job_color_selection_sets_public_token_idx
  on public.job_color_selection_sets (public_token_hash)
  where public_token_hash is not null and public_token_revoked_at is null;

create index if not exists job_color_selections_set_position_idx
  on public.job_color_selections (selection_set_id, position, id);

create index if not exists job_work_orders_org_job_idx
  on public.job_work_orders (org_id, job_id, revision_number desc);

create index if not exists job_work_orders_current_idx
  on public.job_work_orders (org_id, job_id, updated_at desc)
  where status in ('draft', 'issued');

create index if not exists job_invoices_org_job_idx
  on public.job_invoices (org_id, job_id, revision_number desc);

create index if not exists job_invoices_open_idx
  on public.job_invoices (org_id, job_id, due_at)
  where status in ('issued', 'partially_paid');

create index if not exists job_change_orders_org_job_idx
  on public.job_change_orders (org_id, job_id, revision_number desc);

create index if not exists job_change_orders_accepted_idx
  on public.job_change_orders (org_id, job_id, accepted_at desc)
  where status = 'accepted';

create index if not exists job_change_orders_public_token_idx
  on public.job_change_orders (public_token_hash)
  where public_token_hash is not null and public_token_revoked_at is null;

create index if not exists job_operations_events_org_job_idx
  on public.job_operations_events (org_id, job_id, created_at desc);

create index if not exists job_operations_events_related_idx
  on public.job_operations_events (org_id, related_table, related_id, created_at desc)
  where related_table is not null and related_id is not null;

drop trigger if exists trg_paint_brands_set_updated_at on public.paint_brands;
create trigger trg_paint_brands_set_updated_at
before update on public.paint_brands
for each row execute function public.set_updated_at();

drop trigger if exists trg_paint_sheens_set_updated_at on public.paint_sheens;
create trigger trg_paint_sheens_set_updated_at
before update on public.paint_sheens
for each row execute function public.set_updated_at();

drop trigger if exists trg_paint_color_catalog_set_updated_at on public.paint_color_catalog;
create trigger trg_paint_color_catalog_set_updated_at
before update on public.paint_color_catalog
for each row execute function public.set_updated_at();

drop trigger if exists trg_paint_product_sheen_options_set_updated_at on public.paint_product_sheen_options;
create trigger trg_paint_product_sheen_options_set_updated_at
before update on public.paint_product_sheen_options
for each row execute function public.set_updated_at();

drop trigger if exists trg_job_color_selection_sets_set_updated_at on public.job_color_selection_sets;
create trigger trg_job_color_selection_sets_set_updated_at
before update on public.job_color_selection_sets
for each row execute function public.set_updated_at();

drop trigger if exists trg_job_color_selections_set_updated_at on public.job_color_selections;
create trigger trg_job_color_selections_set_updated_at
before update on public.job_color_selections
for each row execute function public.set_updated_at();

drop trigger if exists trg_job_work_orders_set_updated_at on public.job_work_orders;
create trigger trg_job_work_orders_set_updated_at
before update on public.job_work_orders
for each row execute function public.set_updated_at();

drop trigger if exists trg_job_invoices_set_updated_at on public.job_invoices;
create trigger trg_job_invoices_set_updated_at
before update on public.job_invoices
for each row execute function public.set_updated_at();

drop trigger if exists trg_job_change_orders_set_updated_at on public.job_change_orders;
create trigger trg_job_change_orders_set_updated_at
before update on public.job_change_orders
for each row execute function public.set_updated_at();

alter table public.paint_brands enable row level security;
alter table public.paint_color_catalog enable row level security;
alter table public.paint_sheens enable row level security;
alter table public.paint_product_sheen_options enable row level security;
alter table public.job_color_selection_sets enable row level security;
alter table public.job_color_selections enable row level security;
alter table public.job_work_orders enable row level security;
alter table public.job_invoices enable row level security;
alter table public.job_change_orders enable row level security;
alter table public.job_operations_events enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'paint_brands',
    'paint_color_catalog',
    'paint_sheens',
    'paint_product_sheen_options',
    'job_color_selection_sets',
    'job_color_selections',
    'job_work_orders',
    'job_invoices',
    'job_change_orders',
    'job_operations_events'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (exists (select 1 from public.org_members m where m.user_id = auth.uid() and m.org_id = %I.org_id))',
      t || '_select',
      t,
      t
    );

    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (exists (select 1 from public.org_members m where m.user_id = auth.uid() and m.org_id = %I.org_id))',
      t || '_insert',
      t,
      t
    );

    if t <> 'job_operations_events' then
      execute format('drop policy if exists %I on public.%I', t || '_update', t);
      execute format(
        'create policy %I on public.%I for update to authenticated using (exists (select 1 from public.org_members m where m.user_id = auth.uid() and m.org_id = %I.org_id)) with check (exists (select 1 from public.org_members m where m.user_id = auth.uid() and m.org_id = %I.org_id))',
        t || '_update',
        t,
        t,
        t
      );
    end if;

    execute format('revoke all on table public.%I from public', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format('grant select, insert on table public.%I to authenticated', t);
    if t <> 'job_operations_events' then
      execute format('grant update on table public.%I to authenticated', t);
    end if;
    execute format('grant select, insert, update, delete on table public.%I to service_role', t);
  end loop;
end;
$$;

comment on column public.job_color_selection_sets.public_token_hash is
  'Hash of the dedicated post-acceptance customer token. Public routes must validate this token before writing customer selections.';

comment on column public.job_change_orders.public_token_hash is
  'Hash of the customer-facing change-order token. Public routes must validate this token before customer acceptance writes.';
