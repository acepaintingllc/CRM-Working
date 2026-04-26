-- 064_room_condition_columns.sql
-- Adds condition_selections to job settings and condition_factor to scope tables.
-- condition_selections stores which conditions are active (UI state).
-- condition_factor stores the resolved multiplier written on save (calculator input).

do $$
begin
  -- condition_selections on job settings (estimate-level; verify table name matches your schema)
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'estimate_jobsettings'
  ) then
    alter table public.estimate_jobsettings
      add column if not exists condition_selections jsonb null;
  end if;

  -- condition_factor on wall scope rows
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'estimate_room_wall_scopes'
  ) then
    alter table public.estimate_room_wall_scopes
      add column if not exists condition_factor numeric null;
  end if;

  -- condition_factor on ceiling scope rows
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'estimate_room_ceiling_scopes'
  ) then
    alter table public.estimate_room_ceiling_scopes
      add column if not exists condition_factor numeric null;
  end if;

  -- condition_factor on trim scope rows
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'estimate_room_trim_scopes'
  ) then
    alter table public.estimate_room_trim_scopes
      add column if not exists condition_factor numeric null;
  end if;
end $$;
