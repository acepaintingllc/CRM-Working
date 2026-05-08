import { asText, toYN, type UnsafeRecord as Unsafe } from '../../estimator/parsing.ts'
import type { EstimateRoomFlagPersistenceRow } from './persistenceTypes.ts'

export function buildEstimateRoomFlagPersistenceRows(params: {
  orgId: string
  estimateId: string
  jobId: string
  rows: Unsafe[]
  validRoomIds: Set<string>
}): EstimateRoomFlagPersistenceRow[] {
  return params.rows
    .map((row, idx): EstimateRoomFlagPersistenceRow => ({
      id: asText(row.id) || undefined,
      org_id: params.orgId,
      estimate_id: params.estimateId,
      job_id: params.jobId,
      position: idx,
      room_id: asText(row.room_id).toUpperCase() || null,
      flag_id: asText(row.flag_id).toUpperCase(),
      active: toYN(row.active, 'Y'),
    }))
    .filter((row) => !!(row.room_id && row.flag_id && params.validRoomIds.has(row.room_id)))
}
