import {
  asNullableNumber,
  asText,
  toYN,
  type UnsafeRecord as Unsafe,
} from '../../estimator/parsing.ts'
import type { EstimateJobColorPersistenceRow } from './persistenceTypes.ts'

export function buildEstimateJobColorPersistenceRows(params: {
  orgId: string
  estimateId: string
  jobId: string
  rows: Unsafe[]
}): EstimateJobColorPersistenceRow[] {
  return params.rows
    .map((row, idx): EstimateJobColorPersistenceRow => ({
      id: asText(row.id) || undefined,
      org_id: params.orgId,
      estimate_id: params.estimateId,
      job_id: params.jobId,
      position: idx,
      color_id: asText(row.color_id || row.wall_color_id).toUpperCase(),
      color_name: asText(row.color_name) || null,
      roller_cover_id: asText(row.roller_cover_id).toUpperCase() || null,
      roller_cover_qty: asNullableNumber(row.roller_cover_qty),
      active: toYN(row.active, 'Y'),
    }))
    .filter((row) => !!row.color_id)
}
