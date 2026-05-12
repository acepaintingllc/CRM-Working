alter table public.estimate_snapshot_line
  drop constraint if exists estimate_snapshot_line_line_kind_check;

alter table public.estimate_snapshot_line
  add constraint estimate_snapshot_line_line_kind_check
  check (
    line_kind in (
      'walls',
      'ceilings',
      'trim',
      'doors',
      'drywall',
      'other',
      'access',
      'prejob',
      'policy',
      'summary'
    )
  );
