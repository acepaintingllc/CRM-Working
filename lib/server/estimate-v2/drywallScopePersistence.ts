import type { V2DrywallRepairSaveRow } from '../estimateV2RoutePayload.ts'
import type { EstimateDrywallRepairPersistenceRow } from './persistenceTypes.ts'

type EstimatePersistenceContext = {
  orgId: string
  estimateId: string
  jobId: string
}

export function buildV2DrywallRepairPersistenceRows(
  rows: V2DrywallRepairSaveRow[],
  context: EstimatePersistenceContext
): EstimateDrywallRepairPersistenceRow[] {
  return rows.map((row) => ({
    id: row.id ?? undefined,
    org_id: context.orgId,
    estimate_id: context.estimateId,
    job_id: context.jobId,
    room_id: row.room_id,
    position: row.position,
    active: row.active ?? row.include ?? 'Y',
    surface: row.surface,
    repair_type: row.repair_type,
    unit: row.unit,
    quantity: row.quantity,
    raw_quantity: row.raw_quantity,
    effective_quantity: row.effective_quantity,
    base_unit_rate: row.base_unit_rate,
    ceiling_multiplier: row.ceiling_multiplier,
    calculated_total: row.calculated_total,
    override_total: row.override_total,
    raw_total: row.raw_total,
    effective_total: row.effective_total,
  }))
}
