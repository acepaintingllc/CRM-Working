-- Add a default crew_multiplier flag to existing per-color and per-job supply rows.
-- Existing estimates remain unaffected because the default is N.

update public.estimator_template_constant_rows
set values_json = coalesce(values_json, '{}'::jsonb) || jsonb_build_object('crew_multiplier', 'N')
where category_key in ('supply_rates_per_color', 'supply_rates_per_job')
  and not (coalesce(values_json, '{}'::jsonb) ? 'crew_multiplier');
