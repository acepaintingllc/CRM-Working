alter table public.quote_send_defaults
  add column if not exists terms_sections jsonb not null default '{}'::jsonb,
  add column if not exists template_presets jsonb not null default '[]'::jsonb;
