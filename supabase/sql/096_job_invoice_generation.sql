begin;

do $$
begin
  if to_regclass('public.job_invoices') is not null then
    alter table public.job_invoices
      add column if not exists invoice_number text null,
      add column if not exists document_json jsonb not null default '{}'::jsonb,
      add column if not exists generated_at timestamptz null,
      add column if not exists sent_at timestamptz null,
      add column if not exists paid_at timestamptz null,
      add column if not exists voided_at timestamptz null,
      add column if not exists due_date date null,
      add column if not exists payment_terms text null,
      add column if not exists deposit_total numeric not null default 0,
      add column if not exists taxable_subtotal numeric not null default 0,
      add column if not exists tax_rate numeric not null default 0,
      add column if not exists tax_total numeric not null default 0;

    update public.job_invoices
    set
      status = case
        when status in ('issued', 'partially_paid') then 'sent'
        when status in ('voided', 'superseded') then 'void'
        else status
      end,
      document_json = case
        when document_json = '{}'::jsonb then generated_snapshot_json
        else document_json
      end,
      generated_at = case
        when generated_snapshot_json <> '{}'::jsonb then coalesce(generated_at, issued_at, updated_at)
        else generated_at
      end,
      sent_at = case
        when status in ('issued', 'partially_paid') then coalesce(sent_at, issued_at, updated_at)
        else sent_at
      end,
      due_date = coalesce(due_date, due_at::date),
      taxable_subtotal = case
        when taxable_subtotal = 0 then accepted_quote_total + accepted_change_order_total
        else taxable_subtotal
      end,
      invoice_total = case
        when invoice_total = 0 then accepted_quote_total + accepted_change_order_total + tax_total
        else invoice_total
      end,
      balance_due = greatest(
        0,
        case
          when invoice_total = 0 then accepted_quote_total + accepted_change_order_total + tax_total
          else invoice_total
        end - credit_total - payment_total - deposit_total
      )
    where status in ('issued', 'partially_paid', 'voided', 'superseded')
      or document_json = '{}'::jsonb
      or due_date is null
      or taxable_subtotal = 0;

    alter table public.job_invoices
      drop constraint if exists job_invoices_status_check;

    alter table public.job_invoices
      add constraint job_invoices_status_check
      check (status in ('draft', 'sent', 'paid', 'void'));

    alter table public.job_invoices
      drop constraint if exists job_invoices_nonnegative_totals_check;

    alter table public.job_invoices
      add constraint job_invoices_nonnegative_totals_check
      check (
        accepted_quote_total >= 0
        and payment_total >= 0
        and deposit_total >= 0
        and credit_total >= 0
        and taxable_subtotal >= 0
        and tax_rate >= 0
        and tax_total >= 0
        and invoice_total >= 0
        and balance_due >= 0
      );

    drop index if exists job_invoices_open_idx;
    create index if not exists job_invoices_open_idx
      on public.job_invoices (org_id, job_id, due_date)
      where status = 'sent';

    comment on column public.job_invoices.invoice_number is
      'Invoice identifier presented to the customer.';

    comment on column public.job_invoices.payment_terms is
      'Customer-facing invoice payment terms captured on the generated invoice.';

    comment on column public.job_invoices.due_date is
      'Customer-facing due date for the invoice.';

    comment on column public.job_invoices.document_json is
      'Stable generated invoice document derived from accepted estimate source data and accepted change orders.';

    comment on column public.job_invoices.generated_snapshot_json is
      'Legacy operational document snapshot column retained for compatibility; new invoice code writes the same payload to document_json.';
  end if;
end;
$$;

commit;
