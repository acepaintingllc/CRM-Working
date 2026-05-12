begin;

do $$
begin
  if to_regclass('public.job_work_orders') is not null then
    alter table public.job_work_orders
      add column if not exists document_json jsonb not null default '{}'::jsonb,
      add column if not exists generated_at timestamptz null,
      add column if not exists locked_at timestamptz null;

    update public.job_work_orders
    set
      status = case
        when status = 'issued' then 'locked'
        when status in ('superseded', 'voided') then 'void'
        else status
      end,
      document_json = case
        when document_json = '{}'::jsonb then generated_snapshot_json
        else document_json
      end,
      generated_at = case
        when status = 'issued' or generated_snapshot_json <> '{}'::jsonb
          then coalesce(generated_at, issued_at, updated_at)
        else generated_at
      end,
      locked_at = case
        when status = 'issued' then coalesce(locked_at, issued_at, updated_at)
        else locked_at
      end
    where status in ('issued', 'superseded', 'voided')
      or (
        document_json = '{}'::jsonb
        and generated_snapshot_json <> '{}'::jsonb
      );

    alter table public.job_work_orders
      drop constraint if exists job_work_orders_status_check;

    alter table public.job_work_orders
      add constraint job_work_orders_status_check
      check (status in ('draft', 'generated', 'locked', 'void'));

    comment on column public.job_work_orders.document_json is
      'Stable generated crew work-order document. Locked rows must not be silently regenerated in place.';

    comment on column public.job_work_orders.generated_snapshot_json is
      'Legacy operational document snapshot column retained for compatibility; new work-order code writes the same payload to document_json.';
  end if;
end;
$$;

commit;
