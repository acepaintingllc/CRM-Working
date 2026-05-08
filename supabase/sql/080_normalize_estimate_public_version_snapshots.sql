update public.estimate_public_versions
set snapshot_json = jsonb_strip_nulls(
  jsonb_build_object(
    'artifact_kind',
    'customer_estimate_artifact',
    'artifact_version',
    1,
    'document',
    snapshot_json - 'draft' - 'pdf',
    'draft',
    case
      when jsonb_typeof(snapshot_json -> 'draft') = 'object' then snapshot_json -> 'draft'
      else null
    end,
    'pdf',
    case
      when jsonb_typeof(snapshot_json -> 'pdf') = 'object' then snapshot_json -> 'pdf'
      else null
    end
  )
)
where jsonb_typeof(snapshot_json) = 'object'
  and not (snapshot_json ? 'document')
  and snapshot_json ? 'meta';

update public.estimate_public_versions
set snapshot_json = jsonb_strip_nulls(
  jsonb_build_object(
    'artifact_kind',
    'customer_estimate_artifact',
    'artifact_version',
    1,
    'document',
    snapshot_json -> 'document',
    'draft',
    case
      when jsonb_typeof(snapshot_json -> 'draft') = 'object' then snapshot_json -> 'draft'
      else null
    end,
    'pdf',
    case
      when jsonb_typeof(snapshot_json -> 'pdf') = 'object' then snapshot_json -> 'pdf'
      else null
    end
  )
)
where jsonb_typeof(snapshot_json) = 'object'
  and snapshot_json ? 'document'
  and not (
    snapshot_json ->> 'artifact_kind' = 'customer_estimate_artifact'
    and snapshot_json ->> 'artifact_version' = '1'
  )
  and jsonb_typeof(snapshot_json -> 'document') = 'object'
  and (snapshot_json -> 'document') ? 'meta';
