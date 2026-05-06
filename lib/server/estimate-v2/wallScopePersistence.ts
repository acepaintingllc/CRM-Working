import type {
  V2WallScopeSaveRow,
  V2WallSegmentSaveRow,
} from '../estimateV2RoutePayload.ts'
import type {
  EstimateRoomWallScopePersistenceRow,
  EstimateWallScopeSegmentPersistenceRow,
} from './persistenceTypes.ts'

type EstimatePersistenceContext = {
  orgId: string
  estimateId: string
  jobId: string
}

export function buildV2WallScopePersistenceRows(
  rows: V2WallScopeSaveRow[],
  context: EstimatePersistenceContext
): EstimateRoomWallScopePersistenceRow[] {
  return rows.map((row) => ({
    id: row.id,
    org_id: context.orgId,
    estimate_id: context.estimateId,
    job_id: context.jobId,
    room_id: row.room_id,
    position: row.position,
    mode: row.mode,
    include: row.include,
    scope_name: row.scope_name,
    color_id: row.color_id,
    paint_product_id: row.paint_product_id,
    primer_product_id: row.primer_product_id,
    prime_mode: row.prime_mode,
    height_in: row.height_in,
    perimeter_in: row.perimeter_in,
    standard_door_count: row.standard_door_count,
    standard_window_count: row.standard_window_count,
    height_factor: row.height_factor,
    complexity_factor: row.complexity_factor,
    wall_flag_factor: row.wall_flag_factor,
    cut_in_top_factor: row.cut_in_top_factor,
    cut_in_bottom_factor: row.cut_in_bottom_factor,
    paint_coats: row.paint_coats,
    primer_coats: row.primer_coats,
    spot_prime_percent: row.spot_prime_percent,
    raw_area_sf: row.raw_area_sf,
    override_area_sf: row.override_area_sf,
    effective_area_sf: row.effective_area_sf,
    raw_paint_hours: row.raw_paint_hours,
    override_paint_hours: row.override_paint_hours,
    effective_paint_hours: row.effective_paint_hours,
    raw_primer_hours: row.raw_primer_hours,
    override_primer_hours: row.override_primer_hours,
    effective_primer_hours: row.effective_primer_hours,
    raw_paint_gallons: row.raw_paint_gallons,
    override_paint_gallons: row.override_paint_gallons,
    effective_paint_gallons: row.effective_paint_gallons,
    raw_primer_gallons: row.raw_primer_gallons,
    override_primer_gallons: row.override_primer_gallons,
    effective_primer_gallons: row.effective_primer_gallons,
    raw_supply_cost: row.raw_supply_cost,
    override_supply_cost: row.override_supply_cost,
    effective_supply_cost: row.effective_supply_cost,
    raw_total: row.raw_total,
    override_total: row.override_total,
    effective_total: row.effective_total,
    notes: row.notes,
    condition_selections: row.condition_selections ?? null,
  }))
}

export function buildV2WallSegmentPersistenceRows(
  rows: V2WallSegmentSaveRow[],
  context: EstimatePersistenceContext
): EstimateWallScopeSegmentPersistenceRow[] {
  const segNoByScope = new Map<string, number>()
  return rows.map((row) => {
    const nextSegNo = (segNoByScope.get(row.wall_scope_id) ?? 0) + 1
    segNoByScope.set(row.wall_scope_id, nextSegNo)
    return {
      id: row.id,
      org_id: context.orgId,
      estimate_id: context.estimateId,
      job_id: context.jobId,
      wall_scope_id: row.wall_scope_id,
      room_id: row.room_id,
      position: row.position,
      seg_no: nextSegNo,
      segment_name: row.segment_name,
      include: row.include,
      shape_type: row.shape_type,
      quantity: row.quantity,
      width_in: row.width_in,
      height_in: row.height_in,
      base_in: row.base_in,
      manual_area_sf: row.manual_area_sf,
      standard_door_count: row.standard_door_count,
      standard_window_count: row.standard_window_count,
      raw_area_sf: row.raw_area_sf,
      override_area_sf: row.override_area_sf,
      effective_area_sf: row.effective_area_sf,
      notes: row.notes,
    }
  })
}
