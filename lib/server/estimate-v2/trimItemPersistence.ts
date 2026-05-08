import {
  asNullableNumber,
  asText,
  toYN,
  type UnsafeRecord as Unsafe,
} from '../../estimator/parsing.ts'
import type { EstimateTrimItemPersistenceRow } from './persistenceTypes.ts'

export function buildEstimateTrimItemPersistenceRows(params: {
  orgId: string
  estimateId: string
  jobId: string
  rows: Unsafe[]
}): EstimateTrimItemPersistenceRow[] {
  return params.rows
    .map((row, idx): EstimateTrimItemPersistenceRow => ({
      id: asText(row.id) || undefined,
      org_id: params.orgId,
      estimate_id: params.estimateId,
      job_id: params.jobId,
      room_id: asText(row.room_id) || null,
      trim_menu_id: asText(row.trim_menu_id),
      qty: asNullableNumber(row.qty),
      coats: asNullableNumber(row.coats),
      auto_calc: toYN(row.auto_calc, 'N'),
      primer_mode: asText(row.primer_mode) || null,
      spot_prime_pct: asNullableNumber(row.spot_prime_pct),
      prep_level_override: asText(row.prep_level_override) || null,
      door_sides: asNullableNumber(row.door_sides),
      notes: asText(row.notes) || null,
      active: toYN(row.active, 'Y'),
      sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : idx,
    }))
    .filter((row) => row.trim_menu_id && (row.qty ?? 0) > 0)
}
