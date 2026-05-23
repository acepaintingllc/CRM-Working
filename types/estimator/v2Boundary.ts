import type { CeilingCalculationScopeRow, CeilingCalculationSegmentRow } from '../../lib/estimator/ceilingTypes.ts'
import {
  asNullableNumber,
  asNullableNumberFromKeys,
  asText,
  toColorId,
  type UnsafeRecord,
} from '../../lib/estimator/parsing.ts'
import type { TrimCalculationScopeRow } from '../../lib/estimator/trimTypes.ts'
import type { WallCalculationScopeRow, WallCalculationSegmentRow } from '../../lib/estimator/wallsTypes.ts'
import type { DoorCalculationScopeRow } from '@/types/estimator/doors'
import type { DrywallRepairCalculationRow } from '@/types/estimator/drywall'
import type { OtherCalculationRow } from '../../lib/estimator/other.ts'
import type { PrejobTripCalculationRow } from '../../lib/estimator/prejobTrips.ts'
import {
  normalizeConditionSelections,
  type EstimateV2ConditionSelections as CalculationConditionSelections,
} from '../../lib/estimator/conditionModifiers.ts'
import type { EstimateV2JobSettingsInput } from './v2Settings'
import type { EstimateV2SavePayload } from './v2Summary'

export type EstimateV2WallScopeSaveRow = WallCalculationScopeRow
export type EstimateV2WallSegmentSaveRow = WallCalculationSegmentRow
export type EstimateV2CeilingScopeSaveRow = CeilingCalculationScopeRow
export type EstimateV2CeilingSegmentSaveRow = CeilingCalculationSegmentRow
export type EstimateV2TrimScopeSaveRow = TrimCalculationScopeRow
export type EstimateV2DoorScopeSaveRow = DoorCalculationScopeRow
export type EstimateV2DrywallRepairSaveRow = DrywallRepairCalculationRow
export type V2WallScopeSaveRow = EstimateV2WallScopeSaveRow
export type V2WallSegmentSaveRow = EstimateV2WallSegmentSaveRow
export type V2CeilingScopeSaveRow = EstimateV2CeilingScopeSaveRow
export type V2CeilingSegmentSaveRow = EstimateV2CeilingSegmentSaveRow
export type V2TrimScopeSaveRow = EstimateV2TrimScopeSaveRow
export type V2DoorScopeSaveRow = EstimateV2DoorScopeSaveRow
export type V2DrywallRepairSaveRow = EstimateV2DrywallRepairSaveRow

export type EstimateV2RoomRosterCalculationRow = {
  id?: string
  room_id: string
  room_name: string
  room_type_id: string | null
  wall_complexity_id: string | null
  position: number
  notes: string | null
  length_in: number | null
  width_in: number | null
  wallheight_in: number | null
  condition_selections: CalculationConditionSelections | null
}

export type EstimateV2CalculationRoomRow =
  | EstimateV2RoomRosterCalculationRow
  | EstimateV2SavePayload['rooms'][number]

export type EstimateV2AccessFeeCalculationInputRow = {
  id: string
  room_id: string | null
  access_fee_id: string
  qty: number | null
  actual_cost_override: number | null
  notes: string | null
  position: number
  active?: 'Y' | 'N' | null
}

export type EstimateV2CalculationJobSettingsInput = EstimateV2JobSettingsInput & {
  trim_paint_gallons?: number | null
  trim_paint_quarts?: number | null
  trim_paint_qty?: number | null
  trim_paint_uom?: string | null
}

export type EstimateV2NormalizedCalculationRows = {
  rooms: EstimateV2RoomRosterCalculationRow[]
  roomWallScopes: EstimateV2WallScopeSaveRow[]
  wallSegments: EstimateV2WallSegmentSaveRow[]
  roomCeilingScopes: EstimateV2CeilingScopeSaveRow[]
  ceilingScopeSegments: EstimateV2CeilingSegmentSaveRow[]
  roomTrimScopes: EstimateV2TrimScopeSaveRow[]
  roomDoorScopes: EstimateV2DoorScopeSaveRow[]
  drywallRepairs: EstimateV2DrywallRepairSaveRow[]
  accessFees: EstimateV2AccessFeeCalculationInputRow[]
  prejob: PrejobTripCalculationRow[]
  other: OtherCalculationRow[]
}

export type EstimateV2RawCalculationRows = {
  rooms: UnsafeRecord[]
  roomWallScopes: UnsafeRecord[]
  wallSegments: UnsafeRecord[]
  roomCeilingScopes: UnsafeRecord[]
  ceilingScopeSegments: UnsafeRecord[]
  roomTrimScopes: UnsafeRecord[]
  roomDoorScopes?: UnsafeRecord[]
  drywallRepairs?: UnsafeRecord[]
  accessFees?: UnsafeRecord[]
  prejob?: UnsafeRecord[]
  other?: UnsafeRecord[]
}

export type EstimateV2RawJobSettingsRow = UnsafeRecord

function toYN(value: unknown, fallback: 'Y' | 'N' = 'Y') {
  const raw = asText(value).toUpperCase()
  if (raw === 'Y' || raw === 'N') return raw
  return fallback
}

function toWallMode(value: unknown): 'RECT' | 'SEG' {
  return asText(value).toUpperCase() === 'SEG' ? 'SEG' : 'RECT'
}

function toWallPrimeMode(value: unknown): 'NONE' | 'SPOT' | 'FULL' {
  const raw = asText(value).toUpperCase()
  if (raw === 'SPOT' || raw === 'FULL') return raw
  return 'NONE'
}

function toWallSegmentShape(value: unknown): 'RECTANGLE' | 'TRIANGLE' | 'MANUAL' {
  const raw = asText(value).toUpperCase()
  if (raw === 'TRIANGLE' || raw === 'MANUAL') return raw
  return 'RECTANGLE'
}

function toCeilingGeometryMode(value: unknown): 'FLAT' | 'VAULTED' | 'TRAY' | 'COFFERED' | 'MANUAL' {
  const raw = asText(value).toUpperCase()
  if (raw === 'VAULTED' || raw === 'TRAY' || raw === 'COFFERED' || raw === 'MANUAL') return raw
  return 'FLAT'
}

function toTrimUnitType(value: unknown): 'LF' | 'EA' | 'SF' {
  const raw = asText(value).toUpperCase()
  if (raw === 'EA' || raw === 'SF') return raw
  return 'LF'
}

function toTrimMeasurementMode(value: unknown): 'ROOM_HELPER' | 'MANUAL' {
  return asText(value).toUpperCase() === 'ROOM_HELPER' ? 'ROOM_HELPER' : 'MANUAL'
}

function toTrimHelperSource(value: unknown): 'ROOM_PERIMETER' | 'MANUAL' | null {
  const raw = asText(value).toUpperCase()
  if (raw === 'ROOM_PERIMETER' || raw === 'MANUAL') return raw
  return null
}

function toDoorPrimeMode(value: unknown): 'NONE' | 'SPOT' | 'FULL' {
  return toWallPrimeMode(value)
}

function toDrywallSurface(value: unknown): 'wall' | 'ceiling' {
  return asText(value).toLowerCase() === 'ceiling' ? 'ceiling' : 'wall'
}

function toDrywallUnit(value: unknown): 'LF' | 'SQFT' {
  return asText(value).toUpperCase() === 'SQFT' ? 'SQFT' : 'LF'
}

export function normalizeEstimateV2RoomRow(row: UnsafeRecord, index: number): EstimateV2RoomRosterCalculationRow {
  const roomId = asText(row.room_id).toUpperCase() || `R${String(index + 1).padStart(3, '0')}`
  return {
    id: asText(row.id) || undefined,
    room_id: roomId,
    room_name: asText(row.room_name),
    room_type_id: asText(row.room_type_id).toUpperCase() || null,
    wall_complexity_id: asText(row.wall_complexity_id).toUpperCase() || null,
    position: asNullableNumber(row.position) ?? index,
    notes: asText(row.notes) || null,
    length_in: asNullableNumber(row.length_in),
    width_in: asNullableNumber(row.width_in),
    wallheight_in: asNullableNumber(row.wallheight_in),
    condition_selections: normalizeConditionSelections(row.condition_selections),
  }
}

export function normalizeEstimateV2WallScopeRow(row: UnsafeRecord, index: number): EstimateV2WallScopeSaveRow {
  return {
    id: asText(row.id) || undefined,
    room_id: asText(row.room_id).toUpperCase(),
    position: asNullableNumber(row.position) ?? index,
    mode: toWallMode(row.mode),
    include: toYN(row.include),
    scope_name: asText(row.scope_name) || null,
    color_id: toColorId(row.color_id) || null,
    paint_product_id: asText(row.paint_product_id) || null,
    primer_product_id: asText(row.primer_product_id) || null,
    prime_mode: toWallPrimeMode(row.prime_mode),
    height_in: asNullableNumber(row.height_in),
    perimeter_in: asNullableNumber(row.perimeter_in),
    standard_door_count: asNullableNumber(row.standard_door_count),
    standard_window_count: asNullableNumber(row.standard_window_count),
    height_factor: asNullableNumber(row.height_factor),
    complexity_factor: asNullableNumber(row.complexity_factor),
    wall_flag_factor: asNullableNumber(row.wall_flag_factor),
    cut_in_top_factor: asNullableNumber(row.cut_in_top_factor),
    cut_in_bottom_factor: asNullableNumber(row.cut_in_bottom_factor),
    raw_area_sf: asNullableNumber(row.raw_area_sf),
    override_area_sf: asNullableNumber(row.override_area_sf),
    effective_area_sf: asNullableNumber(row.effective_area_sf),
    raw_paint_hours: asNullableNumber(row.raw_paint_hours),
    override_paint_hours: asNullableNumber(row.override_paint_hours),
    effective_paint_hours: asNullableNumber(row.effective_paint_hours),
    raw_primer_hours: asNullableNumber(row.raw_primer_hours),
    override_primer_hours: asNullableNumber(row.override_primer_hours),
    effective_primer_hours: asNullableNumber(row.effective_primer_hours),
    raw_paint_gallons: asNullableNumber(row.raw_paint_gallons),
    override_paint_gallons: asNullableNumber(row.override_paint_gallons),
    effective_paint_gallons: asNullableNumber(row.effective_paint_gallons),
    raw_primer_gallons: asNullableNumber(row.raw_primer_gallons),
    override_primer_gallons: asNullableNumber(row.override_primer_gallons),
    effective_primer_gallons: asNullableNumber(row.effective_primer_gallons),
    raw_supply_cost: asNullableNumber(row.raw_supply_cost),
    override_supply_cost: asNullableNumber(row.override_supply_cost),
    effective_supply_cost: asNullableNumber(row.effective_supply_cost),
    raw_total: asNullableNumber(row.raw_total),
    override_total: asNullableNumber(row.override_total),
    effective_total: asNullableNumber(row.effective_total),
    paint_coats: asNullableNumberFromKeys(row, ['paint_coats', 'wall_coats', 'walls_topcoats']),
    primer_coats: asNullableNumberFromKeys(row, ['primer_coats', 'wall_primer_coats']),
    spot_prime_percent: asNullableNumberFromKeys(row, ['spot_prime_percent', 'wall_spot_prime_pct']),
    paint_coverage_sqft_per_gal_per_coat: asNullableNumberFromKeys(row, [
      'paint_coverage_sqft_per_gal_per_coat',
      'paint_coverage',
    ]),
    primer_coverage_sqft_per_gal_per_coat: asNullableNumberFromKeys(row, [
      'primer_coverage_sqft_per_gal_per_coat',
      'primer_coverage',
    ]),
    paint_prod_rate_sqft_per_hour: asNullableNumberFromKeys(row, [
      'paint_prod_rate_sqft_per_hour',
      'paint_prod_rate',
    ]),
    primer_prod_rate_sqft_per_hour: asNullableNumberFromKeys(row, [
      'primer_prod_rate_sqft_per_hour',
      'primer_prod_rate',
    ]),
    area_supply_cost_per_sf: asNullableNumber(row.area_supply_cost_per_sf),
    per_color_supply_cost: asNullableNumber(row.per_color_supply_cost),
    labor_rate_per_hour: asNullableNumberFromKeys(row, ['labor_rate_per_hour', 'override_labor_rate']),
    paint_price_per_gal: asNullableNumber(row.paint_price_per_gal),
    primer_price_per_gal: asNullableNumber(row.primer_price_per_gal),
    notes: asText(row.notes) || null,
    condition_selections: normalizeConditionSelections(row.condition_selections),
  }
}

export function normalizeEstimateV2WallSegmentRow(row: UnsafeRecord, index: number): EstimateV2WallSegmentSaveRow {
  return {
    id: asText(row.id) || undefined,
    wall_scope_id: asText(row.wall_scope_id),
    room_id: asText(row.room_id).toUpperCase(),
    position: asNullableNumber(row.position) ?? index,
    segment_name: asText(row.segment_name) || null,
    include: toYN(row.include),
    shape_type: toWallSegmentShape(row.shape_type),
    quantity: asNullableNumber(row.quantity) ?? 1,
    width_in: asNullableNumber(row.width_in),
    height_in: asNullableNumber(row.height_in),
    base_in: asNullableNumber(row.base_in),
    manual_area_sf: asNullableNumber(row.manual_area_sf),
    standard_door_count: asNullableNumber(row.standard_door_count),
    standard_window_count: asNullableNumber(row.standard_window_count),
    raw_area_sf: asNullableNumber(row.raw_area_sf),
    override_area_sf: asNullableNumber(row.override_area_sf),
    effective_area_sf: asNullableNumber(row.effective_area_sf),
    notes: asText(row.notes) || null,
  }
}

export function normalizeEstimateV2CeilingScopeRow(row: UnsafeRecord, index: number): EstimateV2CeilingScopeSaveRow {
  return {
    id: asText(row.id) || undefined,
    room_id: asText(row.room_id).toUpperCase(),
    position: asNullableNumber(row.position) ?? index,
    mode: toWallMode(row.mode),
    include: toYN(row.include),
    scope_name: asText(row.scope_name) || null,
    area_sf: asNullableNumber(row.area_sf),
    length_in: asNullableNumber(row.length_in),
    width_in: asNullableNumber(row.width_in),
    ceiling_geometry_mode: toCeilingGeometryMode(row.ceiling_geometry_mode),
    vaulted_area_factor: asNullableNumber(row.vaulted_area_factor),
    vaulted_ridge_length_in: asNullableNumber(row.vaulted_ridge_length_in),
    vaulted_slope_length_in: asNullableNumber(row.vaulted_slope_length_in),
    vaulted_plane_count: asNullableNumber(row.vaulted_plane_count),
    tray_perimeter_in: asNullableNumber(row.tray_perimeter_in),
    tray_step_height_in: asNullableNumber(row.tray_step_height_in),
    tray_band_width_in: asNullableNumber(row.tray_band_width_in),
    coffer_section_length_in: asNullableNumber(row.coffer_section_length_in),
    coffer_section_width_in: asNullableNumber(row.coffer_section_width_in),
    coffer_section_count: asNullableNumber(row.coffer_section_count),
    coffer_face_height_in: asNullableNumber(row.coffer_face_height_in),
    coffer_bottom_width_in: asNullableNumber(row.coffer_bottom_width_in),
    helper_extra_area_sf: asNullableNumber(row.helper_extra_area_sf),
    color_id: toColorId(row.color_id) || null,
    paint_product_id: asText(row.paint_product_id) || null,
    primer_product_id: asText(row.primer_product_id) || null,
    prime_mode: toWallPrimeMode(row.prime_mode),
    spot_prime_percent: asNullableNumber(row.spot_prime_percent),
    ceiling_type_id: asText(row.ceiling_type_id) || null,
    height_factor: asNullableNumber(row.height_factor),
    complexity_factor: asNullableNumber(row.complexity_factor),
    ceiling_flag_factor: asNullableNumber(row.ceiling_flag_factor),
    override_area_sf: asNullableNumber(row.override_area_sf),
    override_paint_hours: asNullableNumber(row.override_paint_hours),
    override_primer_hours: asNullableNumber(row.override_primer_hours),
    override_paint_gallons: asNullableNumber(row.override_paint_gallons),
    override_primer_gallons: asNullableNumber(row.override_primer_gallons),
    override_supply_cost: asNullableNumber(row.override_supply_cost),
    override_total: asNullableNumber(row.override_total),
    raw_area_sf: asNullableNumber(row.raw_area_sf),
    effective_area_sf: asNullableNumber(row.effective_area_sf),
    raw_paint_hours: asNullableNumber(row.raw_paint_hours),
    effective_paint_hours: asNullableNumber(row.effective_paint_hours),
    raw_primer_hours: asNullableNumber(row.raw_primer_hours),
    effective_primer_hours: asNullableNumber(row.effective_primer_hours),
    raw_paint_gallons: asNullableNumber(row.raw_paint_gallons),
    effective_paint_gallons: asNullableNumber(row.effective_paint_gallons),
    raw_primer_gallons: asNullableNumber(row.raw_primer_gallons),
    effective_primer_gallons: asNullableNumber(row.effective_primer_gallons),
    raw_supply_cost: asNullableNumber(row.raw_supply_cost),
    effective_supply_cost: asNullableNumber(row.effective_supply_cost),
    raw_total: asNullableNumber(row.raw_total),
    effective_total: asNullableNumber(row.effective_total),
    notes: asText(row.notes) || null,
    condition_selections: normalizeConditionSelections(row.condition_selections),
    paint_coats: asNullableNumber(row.paint_coats),
    primer_coats: asNullableNumber(row.primer_coats),
    paint_prod_rate_sqft_per_hour: asNullableNumber(row.paint_prod_rate_sqft_per_hour),
    primer_prod_rate_sqft_per_hour: asNullableNumber(row.primer_prod_rate_sqft_per_hour),
    paint_coverage_sqft_per_gal_per_coat: asNullableNumber(row.paint_coverage_sqft_per_gal_per_coat),
    primer_coverage_sqft_per_gal_per_coat: asNullableNumber(row.primer_coverage_sqft_per_gal_per_coat),
    area_supply_cost_per_sf: asNullableNumber(row.area_supply_cost_per_sf),
    per_color_supply_cost: asNullableNumber(row.per_color_supply_cost),
    primer_supply_cost: asNullableNumber(row.primer_supply_cost),
    labor_rate_per_hour: asNullableNumber(row.labor_rate_per_hour),
    paint_price_per_gal: asNullableNumber(row.paint_price_per_gal),
    primer_price_per_gal: asNullableNumber(row.primer_price_per_gal),
  }
}

export function normalizeEstimateV2CeilingSegmentRow(row: UnsafeRecord, index: number): EstimateV2CeilingSegmentSaveRow {
  return {
    id: asText(row.id) || undefined,
    ceiling_scope_id: asText(row.ceiling_scope_id),
    room_id: asText(row.room_id).toUpperCase(),
    position: asNullableNumber(row.position) ?? index,
    segment_name: asText(row.segment_name) || null,
    include: toYN(row.include),
    shape_type: toWallSegmentShape(row.shape_type),
    quantity: asNullableNumber(row.quantity) ?? 1,
    width_in: asNullableNumber(row.width_in),
    height_in: asNullableNumber(row.height_in),
    base_in: asNullableNumber(row.base_in),
    manual_area_sf: asNullableNumber(row.manual_area_sf),
    raw_area_sf: asNullableNumber(row.raw_area_sf),
    override_area_sf: asNullableNumber(row.override_area_sf),
    effective_area_sf: asNullableNumber(row.effective_area_sf),
    notes: asText(row.notes) || null,
  }
}

export function normalizeEstimateV2TrimScopeRow(row: UnsafeRecord, index: number): EstimateV2TrimScopeSaveRow {
  return {
    id: asText(row.id) || undefined,
    room_id: asText(row.room_id).toUpperCase(),
    position: asNullableNumber(row.position) ?? index,
    include: toYN(row.include),
    scope_name: asText(row.scope_name) || null,
    trim_type_id: asText(row.trim_type_id ?? row.trim_menu_id).toUpperCase() || null,
    trim_family: asText(row.trim_family ?? row.category).toUpperCase() || null,
    unit_type: toTrimUnitType(row.unit_type ?? row.unit),
    measurement_mode: toTrimMeasurementMode(row.measurement_mode),
    helper_source: toTrimHelperSource(row.helper_source) === 'ROOM_PERIMETER' ? 'ROOM_PERIMETER' : null,
    measurement_value: asNullableNumber(row.measurement_value ?? row.qty),
    helper_value: asNullableNumber(row.helper_value),
    baseboard_opening_count: asNullableNumber(row.baseboard_opening_count),
    color_id: toColorId(row.color_id) || null,
    paint_product_id: asText(row.paint_product_id) || null,
    primer_product_id: asText(row.primer_product_id) || null,
    paint_enabled: toYN(row.paint_enabled),
    prime_mode: toWallPrimeMode(row.prime_mode ?? row.primer_mode),
    spot_prime_percent: asNullableNumber(row.spot_prime_percent),
    production_rate_id: asText(row.production_rate_id ?? row.rate_id).toUpperCase() || null,
    prep_factor: asNullableNumber(row.prep_factor),
    height_factor: asNullableNumber(row.height_factor),
    profile_factor: asNullableNumber(row.profile_factor),
    room_flag_factor: asNullableNumber(row.room_flag_factor),
    masking_factor: asNullableNumber(row.masking_factor),
    stair_factor: asNullableNumber(row.stair_factor),
    difficult_finish_factor: asNullableNumber(row.difficult_finish_factor),
    caulk_fill_factor: asNullableNumber(row.caulk_fill_factor),
    override_measurement: asNullableNumber(row.override_measurement),
    override_hours: asNullableNumber(row.override_hours),
    override_gallons: asNullableNumber(row.override_gallons),
    override_supply_cost: asNullableNumber(row.override_supply_cost),
    override_total: asNullableNumber(row.override_total),
    override_description: asText(row.override_description) || null,
    raw_measurement: asNullableNumber(row.raw_measurement),
    effective_measurement: asNullableNumber(row.effective_measurement),
    raw_paint_hours: asNullableNumber(row.raw_paint_hours),
    effective_paint_hours: asNullableNumber(row.effective_paint_hours),
    raw_primer_hours: asNullableNumber(row.raw_primer_hours),
    effective_primer_hours: asNullableNumber(row.effective_primer_hours),
    raw_paint_gallons: asNullableNumber(row.raw_paint_gallons),
    effective_paint_gallons: asNullableNumber(row.effective_paint_gallons),
    raw_primer_gallons: asNullableNumber(row.raw_primer_gallons),
    effective_primer_gallons: asNullableNumber(row.effective_primer_gallons),
    raw_supply_cost: asNullableNumber(row.raw_supply_cost),
    effective_supply_cost: asNullableNumber(row.effective_supply_cost),
    raw_total: asNullableNumber(row.raw_total),
    effective_total: asNullableNumber(row.effective_total),
    notes: asText(row.notes) || null,
    condition_selections: normalizeConditionSelections(row.condition_selections),
    paint_coats: asNullableNumber(row.paint_coats),
    primer_coats: asNullableNumber(row.primer_coats),
    paint_prod_rate_units_per_hour: asNullableNumber(row.paint_prod_rate_units_per_hour ?? row.paint_prod_rate_sqft_per_hour),
    primer_prod_rate_units_per_hour: asNullableNumber(row.primer_prod_rate_units_per_hour ?? row.primer_prod_rate_sqft_per_hour),
    paint_coverage_units_per_gal_per_coat: asNullableNumber(row.paint_coverage_units_per_gal_per_coat ?? row.paint_coverage_sqft_per_gal_per_coat),
    primer_coverage_units_per_gal_per_coat: asNullableNumber(row.primer_coverage_units_per_gal_per_coat ?? row.primer_coverage_sqft_per_gal_per_coat),
    area_supply_cost_per_unit: asNullableNumber(row.area_supply_cost_per_unit ?? row.area_supply_cost_per_sf),
    per_color_supply_cost: asNullableNumber(row.per_color_supply_cost),
    primer_supply_cost: asNullableNumber(row.primer_supply_cost),
    labor_rate_per_hour: asNullableNumberFromKeys(row, ['labor_rate_per_hour', 'override_labor_rate']),
    paint_price_per_gal: asNullableNumber(row.paint_price_per_gal),
    primer_price_per_gal: asNullableNumber(row.primer_price_per_gal),
  }
}

export function normalizeEstimateV2DoorScopeRow(row: UnsafeRecord, index: number): EstimateV2DoorScopeSaveRow {
  return {
    id: asText(row.id) || undefined,
    room_id: asText(row.room_id).toUpperCase(),
    position: asNullableNumber(row.position) ?? index,
    include: toYN(row.include),
    scope_name: asText(row.scope_name) || null,
    door_type_id: asText(row.door_type_id).toUpperCase() || null,
    quantity: asNullableNumber(row.quantity),
    sides: asNullableNumber(row.sides),
    color_id: toColorId(row.color_id) || null,
    paint_product_id: asText(row.paint_product_id) || null,
    primer_product_id: asText(row.primer_product_id) || null,
    prime_mode: toDoorPrimeMode(row.prime_mode),
    spot_prime_percent: asNullableNumber(row.spot_prime_percent),
    paint_coats: asNullableNumber(row.paint_coats),
    primer_coats: asNullableNumber(row.primer_coats),
    condition_factor: asNullableNumber(row.condition_factor),
    labor_rate: asNullableNumber(row.labor_rate),
    material_rate: asNullableNumber(row.material_rate),
    override_paint_hours: asNullableNumber(row.override_paint_hours),
    override_primer_hours: asNullableNumber(row.override_primer_hours),
    override_material_cost: asNullableNumber(row.override_material_cost),
    override_supply_cost: asNullableNumber(row.override_supply_cost),
    override_total: asNullableNumber(row.override_total),
    raw_paint_hours: asNullableNumber(row.raw_paint_hours),
    effective_paint_hours: asNullableNumber(row.effective_paint_hours),
    raw_primer_hours: asNullableNumber(row.raw_primer_hours),
    effective_primer_hours: asNullableNumber(row.effective_primer_hours),
    raw_material_cost: asNullableNumber(row.raw_material_cost),
    effective_material_cost: asNullableNumber(row.effective_material_cost),
    raw_supply_cost: asNullableNumber(row.raw_supply_cost),
    effective_supply_cost: asNullableNumber(row.effective_supply_cost),
    raw_total: asNullableNumber(row.raw_total),
    effective_total: asNullableNumber(row.effective_total),
    notes: asText(row.notes) || null,
  }
}

export function normalizeEstimateV2DrywallRepairRow(row: UnsafeRecord, index: number): EstimateV2DrywallRepairSaveRow {
  const active = toYN(row.active ?? row.include, 'Y')
  return {
    id: asText(row.id) || undefined,
    room_id: asText(row.room_id).toUpperCase(),
    position: asNullableNumber(row.position) ?? index,
    include: active,
    active,
    surface: toDrywallSurface(row.surface),
    repair_type: asText(row.repair_type),
    unit: toDrywallUnit(row.unit),
    quantity: asNullableNumber(row.quantity),
    raw_quantity: asNullableNumber(row.raw_quantity),
    effective_quantity: asNullableNumber(row.effective_quantity),
    override_total: asNullableNumber(row.override_total),
    base_unit_rate: asNullableNumber(row.base_unit_rate),
    ceiling_multiplier: asNullableNumber(row.ceiling_multiplier),
    calculated_total: asNullableNumber(row.calculated_total),
    raw_total: asNullableNumber(row.raw_total),
    effective_total: asNullableNumber(row.effective_total),
  }
}

function normalizeAccessFeeRow(row: UnsafeRecord, index: number): EstimateV2AccessFeeCalculationInputRow {
  return {
    id: asText(row.id) || `access-fee-${index}`,
    room_id: asText(row.room_id).toUpperCase() || null,
    access_fee_id: asText(row.access_fee_id),
    qty: asNullableNumber(row.qty),
    actual_cost_override: asNullableNumber(row.actual_cost_override),
    notes: asText(row.notes) || null,
    position: asNullableNumber(row.position) ?? index,
    active: toYN(row.active, 'Y'),
  }
}

function normalizeOtherRow(row: UnsafeRecord, index: number): OtherCalculationRow {
  return {
    id: asText(row.id) || `other-${index}`,
    room_id: asText(row.room_id).toUpperCase() || null,
    position: asNullableNumber(row.position) ?? index,
    active: toYN(row.active ?? row.include, 'Y'),
    description: asText(row.description) || null,
    customer_label: asText(row.customer_label) || null,
    pricing_mode: asText(row.pricing_mode) || null,
    quantity: asNullableNumber(row.quantity),
    unit_rate: asNullableNumber(row.unit_rate),
    labor_hours: asNullableNumber(row.labor_hours),
    labor_rate: asNullableNumber(row.labor_rate),
    material_cost: asNullableNumber(row.material_cost),
    supply_cost: asNullableNumber(row.supply_cost),
    fixed_amount: asNullableNumber(row.fixed_amount),
    rollup_target: asText(row.rollup_target) || null,
    customer_visibility: asText(row.customer_visibility) || null,
    internal_notes: asText(row.internal_notes) || null,
    notes: asText(row.notes) || null,
    client_description: asText(row.client_description) || null,
    location: asText(row.location) || null,
    qty: asNullableNumber(row.qty),
    uom: asText(row.uom) || null,
    labor_hrs_each: asNullableNumber(row.labor_hrs_each),
    materials_each: asNullableNumber(row.materials_each),
  }
}

function normalizePrejobRow(row: UnsafeRecord, index: number): PrejobTripCalculationRow {
  return {
    id: asText(row.id) || `prejob-${index}`,
    room_id: asText(row.room_id).toUpperCase() || null,
    position: asNullableNumber(row.position) ?? index,
    active: toYN(row.active ?? row.include, 'Y'),
    trip_name: asText(row.trip_name ?? row.tripName ?? row.man_trip_name ?? row.task) || null,
    man_trip_name: asText(row.man_trip_name) || null,
    task: asText(row.task) || null,
    trip_num: asNullableNumber(row.trip_num ?? row.tripCount),
    trip_rate: asNullableNumber(row.trip_rate ?? row.tripRate),
    manual_adjustment: asNullableNumber(row.manual_adjustment ?? row.manualAdjustment),
    notes: asText(row.notes) || null,
  }
}

export function normalizeEstimateV2JobSettingsInput(
  row: UnsafeRecord | null | undefined
): EstimateV2CalculationJobSettingsInput | null {
  if (!row) return null
  return {
    labor_day_policy_enabled:
      typeof row.labor_day_policy_enabled === 'boolean' ? row.labor_day_policy_enabled : null,
    dayhours: asNullableNumber(row.dayhours),
    rounding_increment_hours: asNullableNumber(row.rounding_increment_hours),
    override_labor_rate: asNullableNumber(row.override_labor_rate),
    job_minimum_enabled:
      typeof row.job_minimum_enabled === 'boolean' ? row.job_minimum_enabled : null,
    job_minimum_amount: asNullableNumber(row.job_minimum_amount),
    crew_size: asNullableNumber(row.crew_size),
    wall_paint_id: asText(row.wall_paint_id) || null,
    wall_primer_id: asText(row.wall_primer_id) || null,
    walls_paint_id: asText(row.walls_paint_id) || null,
    walls_primer_id: asText(row.walls_primer_id) || null,
    ceiling_paint_id: asText(row.ceiling_paint_id) || null,
    ceiling_primer_id: asText(row.ceiling_primer_id) || null,
    trim_paint_id: asText(row.trim_paint_id) || null,
    trim_primer_id: asText(row.trim_primer_id) || null,
    primer_id: asText(row.primer_id) || null,
    standard_door_deduction_sf: asNullableNumber(row.standard_door_deduction_sf),
    standard_window_deduction_sf: asNullableNumber(row.standard_window_deduction_sf),
    baseboard_opening_deduction_lf: asNullableNumber(row.baseboard_opening_deduction_lf),
    trim_paint_gallons: asNullableNumber(row.trim_paint_gallons),
    trim_paint_quarts: asNullableNumber(row.trim_paint_quarts),
    trim_paint_qty: asNullableNumber(row.trim_paint_qty),
    trim_paint_uom: asText(row.trim_paint_uom) || null,
    condition_selections:
      row.condition_selections && typeof row.condition_selections === 'object'
        ? row.condition_selections as EstimateV2JobSettingsInput['condition_selections']
        : null,
  }
}

export function normalizeEstimateV2CalculationRows(
  rows: EstimateV2RawCalculationRows
): EstimateV2NormalizedCalculationRows {
  return {
    rooms: rows.rooms.map(normalizeEstimateV2RoomRow),
    roomWallScopes: rows.roomWallScopes.map(normalizeEstimateV2WallScopeRow),
    wallSegments: rows.wallSegments.map(normalizeEstimateV2WallSegmentRow),
    roomCeilingScopes: rows.roomCeilingScopes.map(normalizeEstimateV2CeilingScopeRow),
    ceilingScopeSegments: rows.ceilingScopeSegments.map(normalizeEstimateV2CeilingSegmentRow),
    roomTrimScopes: rows.roomTrimScopes.map(normalizeEstimateV2TrimScopeRow),
    roomDoorScopes: (rows.roomDoorScopes ?? []).map(normalizeEstimateV2DoorScopeRow),
    drywallRepairs: (rows.drywallRepairs ?? []).map(normalizeEstimateV2DrywallRepairRow),
    accessFees: (rows.accessFees ?? []).map(normalizeAccessFeeRow),
    prejob: (rows.prejob ?? []).map(normalizePrejobRow),
    other: (rows.other ?? []).map(normalizeOtherRow),
  }
}
