import {
  asNullableNumber,
  asText,
  toYN,
  type UnsafeRecord as Unsafe,
} from '../../estimator/parsing.ts'
import { normalizeWallRollerTargetId } from '../../estimator/rollerIdentity.ts'
import type { EstimateRollerPersistenceRow } from './persistenceTypes.ts'

function normalizeRollerScope(value: unknown): 'Wall' | 'Ceiling' | 'Trim' {
  const raw = asText(value)
  if (raw === 'Ceiling') return 'Ceiling'
  if (raw === 'Trim') return 'Trim'
  return 'Wall'
}

export function buildEstimateRollerPersistenceRows(params: {
  orgId: string
  estimateId: string
  jobId: string
  rows: Unsafe[]
}): EstimateRollerPersistenceRow[] {
  return params.rows
    .map((row, idx): EstimateRollerPersistenceRow => ({
      id: asText(row.id) || undefined,
      org_id: params.orgId,
      estimate_id: params.estimateId,
      job_id: params.jobId,
      position: idx,
      scope: normalizeRollerScope(row.scope),
      wall_color_id: normalizeWallRollerTargetId(asText(row.wall_color_id)) || null,
      selected_option_id: asText(row.selected_option_id) || null,
      roller_size_in: asNullableNumber(row.roller_size_in),
      covers_qty: asNullableNumber(row.covers_qty),
      notes: asText(row.notes) || null,
      active: toYN(row.active, 'Y'),
    }))
    .filter((row) => row.scope === 'Ceiling' || row.scope === 'Trim' || !!row.wall_color_id)
}
