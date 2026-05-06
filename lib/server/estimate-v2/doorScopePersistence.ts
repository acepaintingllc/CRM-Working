import type { V2DoorScopeSaveRow } from '../estimateV2RoutePayload.ts'
import type { EstimateRoomDoorScopePersistenceRow } from './persistenceTypes.ts'

type EstimatePersistenceContext = {
  orgId: string
  estimateId: string
  jobId: string
}

export function buildV2DoorScopePersistenceRows(
  rows: V2DoorScopeSaveRow[],
  context: EstimatePersistenceContext
): EstimateRoomDoorScopePersistenceRow[] {
  return rows.map((row) => ({
    id: row.id ?? undefined,
    org_id: context.orgId,
    estimate_id: context.estimateId,
    job_id: context.jobId,
    room_id: row.room_id,
    position: row.position,
    include: row.include,
    scope_name: row.scope_name,
    door_type_id: row.door_type_id,
    color_id: row.color_id,
    paint_product_id: row.paint_product_id,
    primer_product_id: row.primer_product_id,
    prime_mode: row.prime_mode,
    quantity: row.quantity,
    sides: row.sides,
    paint_coats: row.paint_coats,
    primer_coats: row.primer_coats,
    spot_prime_percent: row.spot_prime_percent,
    condition_factor: row.condition_factor,
    labor_rate: row.labor_rate,
    material_rate: row.material_rate,
    raw_units: row.raw_units,
    effective_units: row.effective_units,
    raw_paint_hours: row.raw_paint_hours,
    override_paint_hours: row.override_paint_hours,
    effective_paint_hours: row.effective_paint_hours,
    raw_primer_hours: row.raw_primer_hours,
    override_primer_hours: row.override_primer_hours,
    effective_primer_hours: row.effective_primer_hours,
    raw_material_cost: row.raw_material_cost,
    override_material_cost: row.override_material_cost,
    effective_material_cost: row.effective_material_cost,
    raw_supply_cost: row.raw_supply_cost,
    override_supply_cost: row.override_supply_cost,
    effective_supply_cost: row.effective_supply_cost,
    raw_total: row.raw_total,
    override_total: row.override_total,
    effective_total: row.effective_total,
    notes: row.notes,
  }))
}
