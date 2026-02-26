alter table public.estimate_segments
  add column if not exists walls_calc_method text;

alter table public.estimate_segments
  add column if not exists panel_length_in numeric;

alter table public.estimate_segments
  add column if not exists panel_height_bottom_in numeric;

alter table public.estimate_segments
  add column if not exists panel_height_top_in numeric;

update public.estimate_segments
set walls_calc_method = 'REGULAR'
where walls_calc_method is null or trim(walls_calc_method) = '';
