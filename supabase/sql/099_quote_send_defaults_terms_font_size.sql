alter table public.quote_send_defaults
  add column if not exists terms_font_size numeric(4,1) not null default 14.8;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'quote_send_defaults_terms_font_size_range'
  ) then
    alter table public.quote_send_defaults
      add constraint quote_send_defaults_terms_font_size_range
      check (terms_font_size between 11 and 18);
  end if;
end $$;
