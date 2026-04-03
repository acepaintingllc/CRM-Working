create or replace function public.replace_job_paint_logs(
  p_org_id uuid,
  p_job_id uuid,
  p_rows jsonb
)
returns void
language plpgsql
as $$
begin
  if p_org_id is null or p_job_id is null then
    raise exception 'org_id and job_id are required';
  end if;

  if p_rows is null then
    p_rows := '[]'::jsonb;
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a JSON array';
  end if;

  delete from public.job_paint_logs
  where org_id = p_org_id
    and job_id = p_job_id;

  insert into public.job_paint_logs (
    org_id,
    job_id,
    sort_order,
    where_used,
    paint_product,
    sheen,
    color,
    notes
  )
  select
    p_org_id,
    p_job_id,
    (item.ordinality - 1)::int,
    nullif(left(trim(both from coalesce(item.value->>'where_used', '')), 200), ''),
    nullif(left(trim(both from coalesce(item.value->>'paint_product', '')), 200), ''),
    nullif(left(trim(both from coalesce(item.value->>'sheen', '')), 120), ''),
    nullif(left(trim(both from coalesce(item.value->>'color', '')), 200), ''),
    nullif(left(trim(both from coalesce(item.value->>'notes', '')), 600), '')
  from jsonb_array_elements(p_rows) with ordinality as item(value, ordinality);
end;
$$;

revoke all on function public.replace_job_paint_logs(uuid, uuid, jsonb) from public;
revoke all on function public.replace_job_paint_logs(uuid, uuid, jsonb) from anon;
revoke all on function public.replace_job_paint_logs(uuid, uuid, jsonb) from authenticated;
grant execute on function public.replace_job_paint_logs(uuid, uuid, jsonb) to service_role;
