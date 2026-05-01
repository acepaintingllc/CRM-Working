with ranked_accepted_public_versions as (
  select
    versions.id,
    row_number() over (
      partition by versions.org_id, versions.estimate_id
      order by
        case
          when estimates.accepted_public_version_id = versions.id then 0
          else 1
        end,
        versions.accepted_at asc nulls last,
        versions.created_at asc,
        versions.id asc
    ) as rn
  from public.estimate_public_versions versions
  left join public.estimates estimates
    on estimates.id = versions.estimate_id
   and estimates.org_id = versions.org_id
  where versions.status = 'accepted'
)
update public.estimate_public_versions versions
set
  status = case when versions.viewed_at is not null then 'viewed' else 'sent' end,
  accepted_at = null,
  locked_at = null,
  acceptance_json = null
from ranked_accepted_public_versions ranked
where versions.id = ranked.id
  and ranked.rn > 1;

create unique index if not exists estimate_public_versions_one_accepted_per_estimate_idx
  on public.estimate_public_versions (org_id, estimate_id)
  where status = 'accepted';
