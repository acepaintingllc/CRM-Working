-- Harden job review classification contracts at the database boundary.
-- Keep these check values aligned with types/jobs/feedback.ts.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_review_primary_cause_tag_check'
      and conrelid = 'public.job_review'::regclass
  ) then
    alter table public.job_review
      add constraint job_review_primary_cause_tag_check
      check (
        primary_cause_tag is null
        or primary_cause_tag in (
          'scope_missed',
          'production_rate',
          'material_usage',
          'change_order',
          'data_entry',
          'other'
        )
      )
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_review_status_contract_check'
      and conrelid = 'public.job_review'::regclass
  ) then
    alter table public.job_review
      add constraint job_review_status_contract_check
      check (status in ('draft', 'reviewed', 'locked'))
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_review_data_quality_status_contract_check'
      and conrelid = 'public.job_review'::regclass
  ) then
    alter table public.job_review
      add constraint job_review_data_quality_status_contract_check
      check (data_quality_status in ('valid', 'questionable', 'invalid'))
      not valid;
  end if;
end $$;

alter table public.job_review
  validate constraint job_review_primary_cause_tag_check;

alter table public.job_review
  validate constraint job_review_status_contract_check;

alter table public.job_review
  validate constraint job_review_data_quality_status_contract_check;
