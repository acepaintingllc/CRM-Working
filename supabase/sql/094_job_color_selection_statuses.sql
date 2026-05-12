begin;

do $$
begin
  if to_regclass('public.job_color_selection_sets') is not null then
    alter table public.job_color_selection_sets
      drop constraint if exists job_color_selection_sets_status_check;

    alter table public.job_color_selection_sets
      add constraint job_color_selection_sets_status_check
      check (status in (
        'draft',
        'customer_open',
        'submitted',
        'confirmed',
        'needs_revision',
        'locked',
        'voided'
      ));
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.job_color_selections') is not null then
    alter table public.job_color_selections
      drop constraint if exists job_color_selections_status_check;

    alter table public.job_color_selections
      add constraint job_color_selections_status_check
      check (status in (
        'draft',
        'submitted',
        'confirmed',
        'needs_revision',
        'locked',
        'voided'
      ));
  end if;
end;
$$;

commit;
