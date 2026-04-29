-- Extend the existing catch-all estimate_other table for Estimator V2 flexible Other items.

alter table public.estimate_other
  add column if not exists room_id text null,
  add column if not exists description text null,
  add column if not exists customer_label text null,
  add column if not exists pricing_mode text null,
  add column if not exists quantity numeric null,
  add column if not exists unit_rate numeric null,
  add column if not exists labor_hours numeric null,
  add column if not exists labor_rate numeric null,
  add column if not exists material_cost numeric null,
  add column if not exists supply_cost numeric null,
  add column if not exists fixed_amount numeric null,
  add column if not exists rollup_target text null,
  add column if not exists customer_visibility text null,
  add column if not exists internal_notes text null;

alter table public.estimate_other
  drop constraint if exists estimate_other_pricing_mode_check,
  add constraint estimate_other_pricing_mode_check
    check (
      pricing_mode is null or
      pricing_mode in ('fixed', 'quantity_rate', 'labor', 'material_supply')
    );

alter table public.estimate_other
  drop constraint if exists estimate_other_rollup_target_check,
  add constraint estimate_other_rollup_target_check
    check (
      rollup_target is null or
      rollup_target in ('other', 'walls', 'ceilings', 'trim', 'doors', 'drywall', 'room_total', 'job_total')
    );

alter table public.estimate_other
  drop constraint if exists estimate_other_customer_visibility_check,
  add constraint estimate_other_customer_visibility_check
    check (
      customer_visibility is null or
      customer_visibility in ('standalone', 'rollup')
    );

create index if not exists estimate_other_room_context_idx
  on public.estimate_other (org_id, estimate_id, room_id, position);
