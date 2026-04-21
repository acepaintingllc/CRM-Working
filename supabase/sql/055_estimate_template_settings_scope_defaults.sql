alter table public.estimate_template_settings
  add column if not exists walls_paint_id text,
  add column if not exists walls_primer_id text,
  add column if not exists ceiling_paint_id text,
  add column if not exists ceiling_primer_id text,
  add column if not exists trim_paint_id text,
  add column if not exists trim_primer_id text;

