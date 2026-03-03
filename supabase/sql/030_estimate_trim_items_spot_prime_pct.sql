alter table public.estimate_trim_items
  add column if not exists spot_prime_pct numeric;

