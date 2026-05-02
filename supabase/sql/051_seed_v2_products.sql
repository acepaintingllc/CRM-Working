-- Seed initial V2 products from CAT_PaintProducts
-- This migration populates v2_products with paint and primer products

-- Get the org_id for seeding (adjust if your setup differs)
-- For now, we'll use a common org_id; in production, iterate through all orgs

insert into public.v2_products (org_id, name, family, base, subtype, cost_per_unit, coverage_sqft_per_gal_per_coat, default_scopes, status, created_at, updated_at)
values
  -- Wall Paints
  ('00000000-0000-0000-0000-000000000000'::uuid, 'ProMar 400', 'Paint', 'SW', 'Wall', 35, 350, ARRAY['Walls'], 'Active', now(), now()),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'Cashmere', 'Paint', 'SW', 'Wall', 55, 350, ARRAY['Walls'], 'Active', now(), now()),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'SuperPaint Interior', 'Paint', 'SW', 'Wall', 51, 350, ARRAY['Walls'], 'Active', now(), now()),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'Duration', 'Paint', 'SW', 'Wall', 62, 350, ARRAY['Walls'], 'Active', now(), now()),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'Emerald Interior', 'Paint', 'SW', 'Wall', 85, 350, ARRAY['Walls'], 'Active', now(), now()),
  -- Ceiling Paints
  ('00000000-0000-0000-0000-000000000000'::uuid, 'ProMar Ceiling White', 'Paint', 'SW', 'Ceiling', 34, 350, ARRAY['Ceilings'], 'Active', now(), now()),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'Ultra Spec 500', 'Paint', 'BM', 'Ceiling', 48, 350, ARRAY['Ceilings'], 'Active', now(), now()),
  -- Trim Paints
  ('00000000-0000-0000-0000-000000000000'::uuid, 'Emerald', 'Paint', 'SW', 'Trim', 80, 350, ARRAY['Trim', 'Doors'], 'Active', now(), now()),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'Emerald Urethane GT', 'Paint', 'SW', 'Trim', 40, 350, ARRAY['Trim', 'Doors'], 'Active', now(), now()),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'ProClassic Trim', 'Paint', 'SW', 'Trim', 75, 350, ARRAY['Trim', 'Doors'], 'Active', now(), now()),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'SuperPaint Exterior', 'Paint', 'SW', 'Wall', 55, 350, ARRAY['Walls'], 'Active', now(), now()),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'SuperPaint Exterior Ceiling', 'Paint', 'SW', 'Ceiling', 60, 350, ARRAY['Ceilings'], 'Active', now(), now()),
  -- Primers
  ('00000000-0000-0000-0000-000000000000'::uuid, 'Zinsser BIN Shellac', 'Primer', 'Zinsser', 'Shellac', 80, 300, ARRAY['Walls', 'Ceilings', 'Trim'], 'Active', now(), now()),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'Zinsser BIN Shellac GT', 'Primer', 'Zinsser', 'Shellac', 40, 300, ARRAY['Trim'], 'Active', now(), now()),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'ProBlock WB', 'Primer', 'SW', 'ProBlock', 24, 300, ARRAY['Walls', 'Ceilings'], 'Active', now(), now()),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'ProBlock WB GT', 'Primer', 'SW', 'ProBlock', 24, 300, ARRAY['Trim'], 'Active', now(), now()),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'Extreme Bond', 'Primer', 'SW', 'Bond', 70, 300, ARRAY['Walls', 'Ceilings', 'Trim'], 'Active', now(), now()),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'Extreme Bond Primer GT', 'Primer', 'SW', 'Bond', 35, 300, ARRAY['Trim', 'Doors'], 'Active', now(), now())
on conflict do nothing;
