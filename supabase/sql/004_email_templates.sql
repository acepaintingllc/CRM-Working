create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  stage text not null,
  subject text not null default '',
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, stage)
);

-- Keep updated_at current
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_email_templates_set_updated_at on public.email_templates;
create trigger trg_email_templates_set_updated_at
before update on public.email_templates
for each row
execute function public.set_updated_at();
