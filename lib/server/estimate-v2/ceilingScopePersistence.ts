import type {
  V2CeilingScopeSaveRow,
  V2CeilingSegmentSaveRow,
} from '../estimateV2RoutePayload.ts'
import type {
  EstimateCeilingScopeSegmentPersistenceRow,
  EstimateRoomCeilingScopePersistenceRow,
} from './persistenceTypes.ts'

type EstimatePersistenceContext = {
  orgId: string
  estimateId: string
  jobId: string
}

export function buildV2CeilingScopePersistenceRows(
  rows: V2CeilingScopeSaveRow[],
  context: EstimatePersistenceContext
): EstimateRoomCeilingScopePersistenceRow[] {
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
    spot_prime_percent: row.spot_prime_percent,
    ceiling_type_id: row.ceiling_type_id,
    ceiling_geometry_mode: row.ceiling_geometry_mode,
    vaulted_area_factor: row.vaulted_area_factor,
    vaulted_ridge_length_in: row.vaulted_ridge_length_in,
    vaulted_slope_length_in: row.vaulted_slope_length_in,
    vaulted_plane_count: row.vaulted_plane_count,
    tray_perimeter_in: row.tray_perimeter_in,
    tray_step_height_in: row.tray_step_height_in,
    tray_band_width_in: row.tray_band_width_in,
    coffer_section_length_in: row.coffer_section_length_in,
    coffer_section_width_in: row.coffer_section_width_in,
    coffer_section_count: row.coffer_section_count,
    coffer_face_height_in: row.coffer_face_height_in,
    coffer_bottom_width_in: row.coffer_bottom_width_in,
    helper_extra_area_sf: row.helper_extra_area_sf,
    length_in: row.length_in,
    width_in: row.width_in,
    area_sf: row.area_sf,
    height_factor: row.height_factor,
    complexity_factor: row.complexity_factor,
    ceiling_flag_factor: row.ceiling_flag_factor,
    override_area_sf: row.override_area_sf,
    override_paint_hours: row.override_paint_hours,
    override_primer_hours: row.override_primer_hours,
    override_paint_gallons: row.override_paint_gallons,
    override_primer_gallons: row.override_primer_gallons,
    override_supply_cost: row.override_supply_cost,
    override_total: row.override_total,
    raw_area_sf: row.raw_area_sf,
    effective_area_sf: row.effective_area_sf,
    raw_paint_hours: row.raw_paint_hours,
    effective_paint_hours: row.effective_paint_hours,
    raw_primer_hours: row.raw_primer_hours,
    effective_primer_hours: row.effective_primer_hours,
    raw_paint_gallons: row.raw_paint_gallons,
    effective_paint_gallons: row.effective_paint_gallons,
    raw_primer_gallons: row.raw_primer_gallons,
    effective_primer_gallons: row.effective_primer_gallons,
    raw_supply_cost: row.raw_supply_cost,
    effective_supply_cost: row.effective_supply_cost,
    raw_total: row.raw_total,
    effective_total: row.effective_total,
    paint_coats: row.paint_coats,
    primer_coats: row.primer_coats,
    notes: row.notes,
    condition_selections: row.condition_selections ?? null,
  }))
}

export function buildV2CeilingScopeSegmentPersistenceRows(
  rows: V2CeilingSegmentSaveRow[],
  context: EstimatePersistenceContext
): EstimateCeilingScopeSegmentPersistenceRow[] {
  return rows.map((row) => ({
    id: row.id,
    org_id: context.orgId,
    estimate_id: context.estimateId,
    job_id: context.jobId,
    ceiling_scope_id: row.ceiling_scope_id,
    room_id: row.room_id,
    position: row.position,
    segment_name: row.segment_name,
    include: row.include,
    shape_type: row.shape_type,
    quantity: row.quantity,
    width_in: row.width_in,
    height_in: row.height_in,
    base_in: row.base_in,
    manual_area_sf: row.manual_area_sf,
    raw_area_sf: row.raw_area_sf,
    override_area_sf: row.override_area_sf,
    effective_area_sf: row.effective_area_sf,
    notes: row.notes,
  }))
}
