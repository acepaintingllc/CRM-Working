-- Create V2 products table
create table if not exists public.v2_products (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  name text not null,
  family text, -- 'Paint', 'Primer', etc.
  base text,
  subtype text,
  cost_per_unit numeric(10, 2),
  coverage_sqft_per_gal_per_coat numeric(10, 2),
  efficiency_pct numeric(5, 2),
  default_coats integer,
  default_sheen text, -- 'Eggshell', 'Satin', 'Flat', etc.
  default_scopes text[], -- e.g., '{"Walls", "Ceilings", "Trim"}'
  notes text,
  status text default 'Active', -- 'Active', 'Inactive', 'Archived'
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.v2_products enable row level security;

-- Create V2 catalog snapshots table
create table if not exists public.v2_catalog_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  estimate_id uuid not null,
  payload_json jsonb not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint v2_catalog_snapshots_org_estimate_unique unique (org_id, estimate_id)
);

alter table public.v2_catalog_snapshots enable row level security;

-- Create indexes for faster queries
create index if not exists idx_v2_products_org_id on public.v2_products(org_id);
create index if not exists idx_v2_products_status on public.v2_products(status);
create index if not exists idx_v2_catalog_snapshots_org_id on public.v2_catalog_snapshots(org_id);
create index if not exists idx_v2_catalog_snapshots_estimate_id on public.v2_catalog_snapshots(estimate_id);

-- Add RLS policies for v2_products
create policy "Users can view v2 products in their org" on public.v2_products for select
  using (
    exists(select 1 from public.org_members 
      where org_members.org_id = v2_products.org_id 
      and org_members.user_id = auth.uid()
    )
  );

create policy "Users can insert v2 products in their org" on public.v2_products for insert
  with check (
    exists(select 1 from public.org_members 
      where org_members.org_id = v2_products.org_id 
      and org_members.user_id = auth.uid()
    )
  );

create policy "Users can update v2 products in their org" on public.v2_products for update
  using (
    exists(select 1 from public.org_members 
      where org_members.org_id = v2_products.org_id 
      and org_members.user_id = auth.uid()
    )
  );

create policy "Users can delete v2 products in their org" on public.v2_products for delete
  using (
    exists(select 1 from public.org_members 
      where org_members.org_id = v2_products.org_id 
      and org_members.user_id = auth.uid()
    )
  );

-- Add RLS policies for v2_catalog_snapshots
create policy "Users can view v2 snapshots in their org" on public.v2_catalog_snapshots for select
  using (
    exists(select 1 from public.org_members 
      where org_members.org_id = v2_catalog_snapshots.org_id 
      and org_members.user_id = auth.uid()
    )
  );

create policy "Users can insert v2 snapshots in their org" on public.v2_catalog_snapshots for insert
  with check (
    exists(select 1 from public.org_members 
      where org_members.org_id = v2_catalog_snapshots.org_id 
      and org_members.user_id = auth.uid()
    )
  );

create policy "Users can update v2 snapshots in their org" on public.v2_catalog_snapshots for update
  using (
    exists(select 1 from public.org_members 
      where org_members.org_id = v2_catalog_snapshots.org_id 
      and org_members.user_id = auth.uid()
    )
  );

create policy "Users can delete v2 snapshots in their org" on public.v2_catalog_snapshots for delete
  using (
    exists(select 1 from public.org_members 
      where org_members.org_id = v2_catalog_snapshots.org_id 
      and org_members.user_id = auth.uid()
    )
  );
