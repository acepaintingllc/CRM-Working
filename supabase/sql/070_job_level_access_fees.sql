-- Access fees are one-time estimate/job-level charges.
-- room_id is optional context only.

alter table public.estimate_access_fees
  alter column room_id drop not null;

-- Existing room/segment-level active rows can collide under the new job-level key.
with ranked_access_fees as (
  select
    id,
    row_number() over (
      partition by org_id, estimate_id, access_fee_id
      order by position asc, created_at asc, id asc
    ) as duplicate_rank
  from public.estimate_access_fees
  where active = 'Y'
    and access_fee_id is not null
    and btrim(access_fee_id) <> ''
)
update public.estimate_access_fees fee
set active = 'N'
from ranked_access_fees ranked
where fee.id = ranked.id
  and ranked.duplicate_rank > 1;

drop index if exists public.estimate_access_fees_active_key;

create unique index if not exists estimate_access_fees_active_job_level_key
  on public.estimate_access_fees (org_id, estimate_id, access_fee_id)
  where active = 'Y'
    and access_fee_id is not null
    and btrim(access_fee_id) <> '';

create index if not exists estimate_access_fees_room_context_idx
  on public.estimate_access_fees (org_id, estimate_id, room_id)
  where room_id is not null;

-- The structured V2 save RPC used to reject access fees without a room_id.
-- Keep the existing function body and only loosen the access-fee row predicate.
do $$
declare
  function_sql text;
  old_predicate text := $predicate$
where trim(coalesce(row->>'room_id', '')) <> ''
      and trim(coalesce(row->>'access_fee_id', '')) <> ''
$predicate$;
  new_predicate text := $predicate$
where trim(coalesce(row->>'access_fee_id', '')) <> ''
$predicate$;
begin
  select pg_get_functiondef('public.save_estimate_v2_inputs(uuid,uuid,uuid,jsonb)'::regprocedure)
  into function_sql;

  if function_sql is null then
    raise exception 'public.save_estimate_v2_inputs(uuid,uuid,uuid,jsonb) is missing';
  end if;

  if position(old_predicate in function_sql) = 0 then
    raise exception 'access fee room_id predicate was not found in save_estimate_v2_inputs';
  end if;

  function_sql := replace(function_sql, old_predicate, new_predicate);
  execute function_sql;
end $$;
