import {
  asNullableNumber,
  asText,
  toYN,
  type UnsafeRecord as Unsafe,
} from '../../estimator/parsing.ts'
import type { EstimateAccessFeePersistenceRow } from './persistenceTypes.ts'

export function buildEstimateAccessFeePersistenceRows(params: {
  orgId: string
  estimateId: string
  jobId: string
  rows: Unsafe[]
}): EstimateAccessFeePersistenceRow[] {
  return params.rows
    .map((row, idx) => ({
      id: asText(row.id) || undefined,
      org_id: params.orgId,
      estimate_id: params.estimateId,
      job_id: params.jobId,
      position: idx,
      room_id: asText(row.room_id).toUpperCase() || null,
      segment_num: asNullableNumber(row.segment_num ?? row.segment_id),
      access_fee_id: asText(row.access_fee_id).toUpperCase(),
      qty: asNullableNumber(row.qty) ?? 1,
      active: toYN(row.active, 'Y'),
      notes: asText(row.notes) || null,
      actual_cost_override: asNullableNumber(row.actual_cost_override),
    }))
    .filter((row) => !!row.access_fee_id)
}
