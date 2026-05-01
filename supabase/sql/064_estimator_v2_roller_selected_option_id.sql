-- Store roller/applicator selections by stable rates-and-flags option identity.
-- Existing size-only rows remain valid and hydrate through the legacy fallback.

alter table public.estimate_rollers
  add column if not exists selected_option_id text null;

create index if not exists estimate_rollers_selected_option_id_idx
  on public.estimate_rollers (org_id, selected_option_id)
  where selected_option_id is not null;
