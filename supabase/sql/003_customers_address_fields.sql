-- Add missing customer address fields (idempotent)
alter table public.customers add column if not exists street text;
alter table public.customers add column if not exists city text;
alter table public.customers add column if not exists state text;
alter table public.customers add column if not exists zip text;
alter table public.customers add column if not exists notes text;
alter table public.customers add column if not exists address text;

-- Backfill address if we have parts
update public.customers
set address = concat_ws(', ', nullif(street, ''), nullif(city, ''), nullif(trim(concat_ws(' ', state, zip)), ''))
where address is null;
