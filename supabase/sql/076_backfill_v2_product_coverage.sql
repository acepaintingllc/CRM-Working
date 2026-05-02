-- Backfill explicit coverage for seeded V2 products that predate coverage values.
-- Estimator strict inputs still require coverage to come from catalog data.
update public.v2_products
set
  coverage_sqft_per_gal_per_coat = case
    when lower(coalesce(family, '')) = 'primer' then 300
    else 350
  end,
  updated_at = now()
where (
    coverage_sqft_per_gal_per_coat is null
    or coverage_sqft_per_gal_per_coat <= 0
  )
  and lower(coalesce(family, '')) in ('paint', 'primer');
