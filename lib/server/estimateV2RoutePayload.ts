import type {
  WallCalculationCatalogs,
  WallCalculationScopeRow,
  WallCalculationSegmentRow,
} from '../estimator/walls.ts'
import type {
  CeilingCalculationScopeRow,
  CeilingCalculationSegmentRow,
} from '../estimator/ceilings.ts'
import type {
  TrimCalculationScopeRow,
  TrimHelperSource,
  TrimMeasurementMode,
  TrimUnitType,
} from '../estimator/trimTypes.ts'
import {
  asNullableNumber,
  asNullableNumberFromKeys,
  asText,
  isUuid,
  toColorId,
  toYN,
  type UnsafeRecord as Unsafe,
} from '../estimator/parsing.ts'

function nextRoomId(used: Set<string>, startAt: number) {
  let n = Math.max(1, startAt)
  while (used.has(`R${String(n).padStart(3, '0')}`)) {
    n += 1
  }
  return `R${String(n).padStart(3, '0')}`
}

function toWallScopeMode(value: unknown): 'RECT' | 'SEG' {
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

export type V2RoomRosterRow = {
  id?: string
  room_id: string
  room_name: string
  position: number
  notes: string | null
  length_in: number | null
  width_in: number | null
  wallheight_in: number | null
}

export type V2WallScopeSaveRow = WallCalculationScopeRow
export type V2WallSegmentSaveRow = WallCalculationSegmentRow

export function buildV2RoomRosterRows(rows: Unsafe[]) {
  const usedRoomIds = new Set<string>()
  return rows.map((row, idx) => {
    const roomName = asText(row.room_name)
    if (!roomName) {
      throw new Error(`Room ${idx + 1}: room name is required`)
    }
    const requestedRoomId = asText(row.room_id).toUpperCase()
    const roomId = requestedRoomId || nextRoomId(usedRoomIds, idx + 1)
    if (usedRoomIds.has(roomId)) {
      throw new Error(`Room ${idx + 1}: room id ${roomId} is duplicated`)
    }
    usedRoomIds.add(roomId)
    return {
      id: isUuid(row.id) ? asText(row.id) : undefined,
      room_id: roomId,
      room_name: roomName,
      position: idx,
      notes: asText(row.notes) || null,
      length_in: asNullableNumber(row.length_in),
      width_in: asNullableNumber(row.width_in),
      wallheight_in: asNullableNumber(row.wallheight_in),
    } satisfies V2RoomRosterRow
  })
}

export function buildV2WallScopeRows(rows: Unsafe[], roomIds: Set<string>) {
  const modeByRoom = new Map<string, 'RECT' | 'SEG'>()
  const rectCountByRoom = new Map<string, number>()
  const positionByRoom = new Map<string, number>()

  const scopeRows = rows.map((row, idx) => {
    const roomId = asText(row.room_id).toUpperCase()
    if (!roomId || !roomIds.has(roomId)) {
      throw new Error(`Wall scope ${idx + 1}: room is missing or invalid`)
    }
    const mode = toWallScopeMode(row.mode)
    const knownMode = modeByRoom.get(roomId)
    if (knownMode && knownMode !== mode) {
      throw new Error(`Room ${roomId}: all wall scopes must use the same mode`)
    }
    modeByRoom.set(roomId, mode)
    if (mode === 'RECT') {
      const nextRectCount = (rectCountByRoom.get(roomId) ?? 0) + 1
      rectCountByRoom.set(roomId, nextRectCount)
      if (nextRectCount > 1) {
        throw new Error(`Room ${roomId}: only one active RECT wall scope is allowed`)
      }
    }

    const nextPosition = positionByRoom.get(roomId) ?? 0
    positionByRoom.set(roomId, nextPosition + 1)

    return {
      id: isUuid(row.id) ? asText(row.id) : undefined,
      room_id: roomId,
      position: nextPosition,
      mode,
      include: toYN(row.include, 'Y'),
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
      area_supply_cost_per_sf: asNullableNumberFromKeys(row, ['area_supply_cost_per_sf']),
      per_color_supply_cost: asNullableNumberFromKeys(row, ['per_color_supply_cost']),
      labor_rate_per_hour: asNullableNumberFromKeys(row, ['labor_rate_per_hour', 'override_labor_rate']),
      paint_price_per_gal: asNullableNumberFromKeys(row, ['paint_price_per_gal']),
      primer_price_per_gal: asNullableNumberFromKeys(row, ['primer_price_per_gal']),
      notes: asText(row.notes) || null,
    } satisfies V2WallScopeSaveRow
  })

  return {
    scopeRows,
    scopeIds: new Set(
      scopeRows
        .map((row) => row.id)
        .filter((value): value is string => !!value)
    ),
    modeByRoom,
  }
}

export function buildV2WallSegmentRows(rows: Unsafe[], scopeRows: V2WallScopeSaveRow[]) {
  const roomIdByScopeId = new Map<string, string>()
  const modeByScopeId = new Map<string, 'RECT' | 'SEG'>()
  for (const scope of scopeRows) {
    if (!scope.id) continue
    roomIdByScopeId.set(scope.id, scope.room_id)
    modeByScopeId.set(scope.id, scope.mode)
  }

  const positionByScope = new Map<string, number>()
  return rows.map((row, idx) => {
    const scopeId = asText(row.wall_scope_id)
    const scopeRoomId = roomIdByScopeId.get(scopeId)
    if (!scopeId || !scopeRoomId) {
      throw new Error(`Wall segment ${idx + 1}: wall scope is missing or invalid`)
    }
    if (modeByScopeId.get(scopeId) !== 'SEG') {
      throw new Error(`Wall segment ${idx + 1}: segments can only belong to SEG scopes`)
    }

    const shapeType = toWallSegmentShape(row.shape_type)
    const quantity = asNullableNumber(row.quantity)
    if (quantity == null || quantity <= 0) {
      throw new Error(`Wall segment ${idx + 1}: quantity must be greater than 0`)
    }

    const widthIn = asNullableNumber(row.width_in)
    const heightIn = asNullableNumber(row.height_in)
    const baseIn = asNullableNumber(row.base_in)
    const manualAreaSf = asNullableNumber(row.manual_area_sf)
    if (shapeType === 'RECTANGLE' && (widthIn == null || heightIn == null)) {
      throw new Error(`Wall segment ${idx + 1}: rectangle segments require width and height`)
    }
    if (shapeType === 'TRIANGLE' && (baseIn == null || heightIn == null)) {
      throw new Error(`Wall segment ${idx + 1}: triangle segments require base and height`)
    }
    if (shapeType === 'MANUAL' && manualAreaSf == null) {
      throw new Error(`Wall segment ${idx + 1}: manual segments require area`)
    }

    const nextPosition = positionByScope.get(scopeId) ?? 0
    positionByScope.set(scopeId, nextPosition + 1)

    return {
      id: isUuid(row.id) ? asText(row.id) : undefined,
      wall_scope_id: scopeId,
      room_id: scopeRoomId,
      position: nextPosition,
      segment_name: asText(row.segment_name) || null,
      include: toYN(row.include, 'Y'),
      shape_type: shapeType,
      quantity,
      width_in: widthIn,
      height_in: heightIn,
      base_in: baseIn,
      manual_area_sf: manualAreaSf,
      standard_door_count: asNullableNumber(row.standard_door_count),
      standard_window_count: asNullableNumber(row.standard_window_count),
      raw_area_sf: asNullableNumber(row.raw_area_sf),
      override_area_sf: asNullableNumber(row.override_area_sf),
      effective_area_sf: asNullableNumber(row.effective_area_sf),
      notes: asText(row.notes) || null,
    } satisfies V2WallSegmentSaveRow
  })
}

// ─── Ceiling scope builders ───────────────────────────────────────────────────

function toCeilingScopeMode(value: unknown): 'RECT' | 'SEG' {
  return asText(value).toUpperCase() === 'SEG' ? 'SEG' : 'RECT'
}

function toCeilingPrimeMode(value: unknown): 'NONE' | 'SPOT' | 'FULL' {
  const raw = asText(value).toUpperCase()
  if (raw === 'SPOT' || raw === 'FULL') return raw
  return 'NONE'
}

function toCeilingSegmentShape(value: unknown): 'RECTANGLE' | 'TRIANGLE' | 'MANUAL' {
  const raw = asText(value).toUpperCase()
  if (raw === 'TRIANGLE' || raw === 'MANUAL') return raw
  return 'RECTANGLE'
}

function toTrimPrimeMode(value: unknown): 'NONE' | 'SPOT' | 'FULL' {
  const raw = asText(value).toUpperCase()
  if (raw === 'SPOT' || raw === 'FULL') return raw
  return 'NONE'
}

function toTrimUnitType(value: unknown): TrimUnitType {
  const raw = asText(value).toUpperCase()
  if (raw === 'EA' || raw === 'SF') return raw
  return 'LF'
}

function toTrimMeasurementMode(value: unknown): TrimMeasurementMode {
  return asText(value).toUpperCase() === 'ROOM_HELPER' ? 'ROOM_HELPER' : 'MANUAL'
}

function toTrimHelperSource(value: unknown): TrimHelperSource | null {
  const raw = asText(value).toUpperCase()
  return raw === 'ROOM_PERIMETER' ? raw : null
}

export type V2CeilingScopeSaveRow = CeilingCalculationScopeRow
export type V2CeilingSegmentSaveRow = CeilingCalculationSegmentRow
export type V2TrimScopeSaveRow = TrimCalculationScopeRow

export function buildV2CeilingScopeRows(rows: Unsafe[], roomIds: Set<string>) {
  const modeByRoom = new Map<string, 'RECT' | 'SEG'>()
  const rectCountByRoom = new Map<string, number>()
  const positionByRoom = new Map<string, number>()

  const scopeRows = rows.map((row, idx) => {
    const roomId = asText(row.room_id).toUpperCase()
    if (!roomId || !roomIds.has(roomId)) {
      throw new Error(`Ceiling scope ${idx + 1}: room is missing or invalid`)
    }
    const mode = toCeilingScopeMode(row.mode)
    const knownMode = modeByRoom.get(roomId)
    if (knownMode && knownMode !== mode) {
      throw new Error(`Room ${roomId}: all ceiling scopes must use the same mode`)
    }
    modeByRoom.set(roomId, mode)
    if (mode === 'RECT') {
      const nextCount = (rectCountByRoom.get(roomId) ?? 0) + 1
      rectCountByRoom.set(roomId, nextCount)
      if (nextCount > 1) {
        throw new Error(`Room ${roomId}: only one active RECT ceiling scope is allowed`)
      }
    }

    const nextPosition = positionByRoom.get(roomId) ?? 0
    positionByRoom.set(roomId, nextPosition + 1)

    return {
      id: isUuid(row.id) ? asText(row.id) : undefined,
      room_id: roomId,
      position: nextPosition,
      mode,
      include: toYN(row.include, 'Y'),
      scope_name: asText(row.scope_name) || null,
      color_id: toColorId(row.color_id) || null,
      paint_product_id: asText(row.paint_product_id) || null,
      primer_product_id: asText(row.primer_product_id) || null,
      prime_mode: toCeilingPrimeMode(row.prime_mode),
      spot_prime_percent: asNullableNumber(row.spot_prime_percent),
      ceiling_type_id: asText(row.ceiling_type_id) || null,
      length_in: asNullableNumber(row.length_in),
      width_in: asNullableNumber(row.width_in),
      area_sf: asNullableNumber(row.area_sf),
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
      paint_coats: asNullableNumber(row.paint_coats),
      primer_coats: asNullableNumber(row.primer_coats),
      paint_prod_rate_sqft_per_hour: asNullableNumber(row.paint_prod_rate_sqft_per_hour),
      primer_prod_rate_sqft_per_hour: asNullableNumber(row.primer_prod_rate_sqft_per_hour),
      paint_coverage_sqft_per_gal_per_coat: asNullableNumber(row.paint_coverage_sqft_per_gal_per_coat),
      primer_coverage_sqft_per_gal_per_coat: asNullableNumber(row.primer_coverage_sqft_per_gal_per_coat),
      area_supply_cost_per_sf: asNullableNumber(row.area_supply_cost_per_sf),
      per_color_supply_cost: asNullableNumber(row.per_color_supply_cost),
      labor_rate_per_hour: asNullableNumberFromKeys(row, ['labor_rate_per_hour', 'override_labor_rate']),
      paint_price_per_gal: asNullableNumber(row.paint_price_per_gal),
      primer_price_per_gal: asNullableNumber(row.primer_price_per_gal),
      notes: asText(row.notes) || null,
    } satisfies V2CeilingScopeSaveRow
  })

  return {
    scopeRows,
    scopeIds: new Set(
      scopeRows
        .map((row) => row.id)
        .filter((value): value is string => !!value)
    ),
    modeByRoom,
  }
}

export function buildV2CeilingSegmentRows(rows: Unsafe[], scopeRows: V2CeilingScopeSaveRow[]) {
  const roomIdByScopeId = new Map<string, string>()
  const modeByScopeId = new Map<string, 'RECT' | 'SEG'>()
  for (const scope of scopeRows) {
    if (!scope.id) continue
    roomIdByScopeId.set(scope.id, scope.room_id)
    modeByScopeId.set(scope.id, scope.mode)
  }

  const positionByScope = new Map<string, number>()
  return rows.map((row, idx) => {
    const scopeId = asText(row.ceiling_scope_id)
    const scopeRoomId = roomIdByScopeId.get(scopeId)
    if (!scopeId || !scopeRoomId) {
      throw new Error(`Ceiling segment ${idx + 1}: ceiling scope is missing or invalid`)
    }
    if (modeByScopeId.get(scopeId) !== 'SEG') {
      throw new Error(`Ceiling segment ${idx + 1}: segments can only belong to SEG scopes`)
    }

    const shapeType = toCeilingSegmentShape(row.shape_type)
    const quantity = asNullableNumber(row.quantity)
    if (quantity == null || quantity <= 0) {
      throw new Error(`Ceiling segment ${idx + 1}: quantity must be greater than 0`)
    }

    const widthIn = asNullableNumber(row.width_in)
    const heightIn = asNullableNumber(row.height_in)
    const baseIn = asNullableNumber(row.base_in)
    const manualAreaSf = asNullableNumber(row.manual_area_sf)
    if (shapeType === 'RECTANGLE' && (widthIn == null || heightIn == null)) {
      throw new Error(`Ceiling segment ${idx + 1}: rectangle segments require width and height`)
    }
    if (shapeType === 'TRIANGLE' && (baseIn == null || heightIn == null)) {
      throw new Error(`Ceiling segment ${idx + 1}: triangle segments require base and height`)
    }
    if (shapeType === 'MANUAL' && manualAreaSf == null) {
      throw new Error(`Ceiling segment ${idx + 1}: manual segments require area`)
    }

    const nextPosition = positionByScope.get(scopeId) ?? 0
    positionByScope.set(scopeId, nextPosition + 1)

    return {
      id: isUuid(row.id) ? asText(row.id) : undefined,
      ceiling_scope_id: scopeId,
      room_id: scopeRoomId,
      position: nextPosition,
      segment_name: asText(row.segment_name) || null,
      include: toYN(row.include, 'Y'),
      shape_type: shapeType,
      quantity,
      width_in: widthIn,
      height_in: heightIn,
      base_in: baseIn,
      manual_area_sf: manualAreaSf,
      raw_area_sf: asNullableNumber(row.raw_area_sf),
      override_area_sf: asNullableNumber(row.override_area_sf),
      effective_area_sf: asNullableNumber(row.effective_area_sf),
      notes: asText(row.notes) || null,
    } satisfies V2CeilingSegmentSaveRow
  })
}

// ─── Trim scope builders ──────────────────────────────────────────────────────

export function buildV2TrimScopeRows(rows: Unsafe[], roomIds: Set<string>) {
  const positionByRoom = new Map<string, number>()
  const scopeRows = rows.map((row, idx) => {
    const roomId = asText(row.room_id).toUpperCase()
    if (!roomId || !roomIds.has(roomId)) {
      throw new Error(`Trim scope ${idx + 1}: room is missing or invalid`)
    }
    const nextPosition = positionByRoom.get(roomId) ?? 0
    positionByRoom.set(roomId, nextPosition + 1)

    return {
      id: isUuid(row.id) ? asText(row.id) : undefined,
      room_id: roomId,
      position: nextPosition,
      include: toYN(row.include, 'Y'),
      scope_name: asText(row.scope_name) || null,
      trim_type_id: asText(row.trim_type_id || row.trim_menu_id).toUpperCase() || null,
      trim_family: asText(row.trim_family || row.category).toUpperCase() || null,
      unit_type: toTrimUnitType(row.unit_type || row.unit),
      measurement_mode: toTrimMeasurementMode(row.measurement_mode),
      helper_source: toTrimHelperSource(row.helper_source),
      measurement_value: asNullableNumber(row.measurement_value ?? row.qty),
      helper_value: asNullableNumber(row.helper_value),
      baseboard_opening_count: asNullableNumber(row.baseboard_opening_count),
      color_id: toColorId(row.color_id) || null,
      paint_product_id: asText(row.paint_product_id) || null,
      primer_product_id: asText(row.primer_product_id) || null,
      paint_enabled: toYN(row.paint_enabled, 'Y'),
      prime_mode: toTrimPrimeMode(row.prime_mode ?? row.primer_mode),
      spot_prime_percent: asNullableNumber(row.spot_prime_percent),
      production_rate_id: asText(row.production_rate_id || row.rate_id).toUpperCase() || null,
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
      notes: asText(row.notes) || null,
    } satisfies V2TrimScopeSaveRow
  })

  return {
    scopeRows,
    scopeIds: new Set(
      scopeRows
        .map((row) => row.id)
        .filter((value): value is string => !!value)
    ),
  }
}

// ─── Catalog builders ─────────────────────────────────────────────────────────

export function toWallCalculationCatalogs(raw: Unsafe | null | undefined): WallCalculationCatalogs | null {
  if (!raw || typeof raw !== 'object') return null
  const catalogs = raw as {
    paint_products?: Unsafe[]
    supplies_rates?: Unsafe[]
  }
  return {
    paint_products: Array.isArray(catalogs.paint_products)
      ? catalogs.paint_products.map((row) => ({
          id: asText((row as Unsafe).id),
          type: asText((row as Unsafe).type),
          label: asText((row as Unsafe).label || (row as Unsafe).name || (row as Unsafe).type),
          price_per_gal: asNullableNumber((row as Unsafe).price_per_gal),
          coverage_sqft_per_gal_per_coat: asNullableNumber(
            (row as Unsafe).coverage_sqft_per_gal_per_coat
          ),
        }))
      : [],
    supplies_rates: Array.isArray(catalogs.supplies_rates)
      ? catalogs.supplies_rates.map((row) => ({
          key: asText((row as Unsafe).key),
          scope: asText((row as Unsafe).scope) || null,
          unit: asText((row as Unsafe).unit) || null,
          value: asNullableNumber((row as Unsafe).value) ?? 0,
        }))
      : [],
  }
}

export function toCeilingCalculationCatalogs(raw: Unsafe | null | undefined) {
  const base = toWallCalculationCatalogs(raw)
  if (!raw || typeof raw !== 'object') return null
  const catalogs = raw as { ceiling_types?: Unsafe[] }
  return {
    ...base,
    ceiling_types: Array.isArray(catalogs.ceiling_types)
      ? catalogs.ceiling_types.map((row) => ({
          id: asText((row as Unsafe).id),
          labor_mult: asNullableNumber((row as Unsafe).labor_mult),
        }))
      : [],
  }
}

export function toTrimCalculationCatalogs(raw: Unsafe | null | undefined) {
  const base = toWallCalculationCatalogs(raw)
  if (!raw || typeof raw !== 'object') return null
  const catalogs = raw as { trim_items?: Unsafe[]; production_rates?: Unsafe[] }
  return {
    ...base,
    trim_items: Array.isArray(catalogs.trim_items)
      ? catalogs.trim_items.map((row) => ({
          id: asText((row as Unsafe).id),
          family: asText((row as Unsafe).family || (row as Unsafe).category) || null,
          default_unit_type: toTrimUnitType((row as Unsafe).unit_type || (row as Unsafe).unit),
          helper_allowed:
            asText((row as Unsafe).helper_allowed).toUpperCase() === 'Y' ||
            (row as Unsafe).helper_allowed === true,
          default_production_rate_id:
            asText((row as Unsafe).default_production_rate_id || (row as Unsafe).production_rate_id) || null,
        }))
      : [],
    production_rates: Array.isArray(catalogs.production_rates)
      ? catalogs.production_rates
          .map((row) => ({
            id: asText((row as Unsafe).id),
            scope_id: asText((row as Unsafe).scope_id || (row as Unsafe).scope) || null,
            units_per_hour: asNullableNumber((row as Unsafe).sqft_per_hr ?? (row as Unsafe).units_per_hour),
            prep_units_per_hour: asNullableNumber((row as Unsafe).prep_sqft_per_hr ?? (row as Unsafe).prep_units_per_hour),
            primer_units_per_hour: asNullableNumber((row as Unsafe).primer_sqft_per_hr ?? (row as Unsafe).primer_units_per_hour),
          }))
          .filter((row) => row.id)
      : [],
  }
}
