import { asNullableNumber, asText } from '../../../../../../lib/estimator/parsing.ts'
import type {
  EstimateV2CeilingPrimeMode,
  EstimateV2CeilingScopeDraft,
  EstimateV2CeilingScopeMode,
  EstimateV2CeilingSegmentDraft,
  EstimateV2CeilingSegmentShape,
  EstimateV2RoomDraft,
  EstimateV2RoomFlagDraft,
  EstimateV2RollerDraft,
  EstimateV2RollerScope,
  EstimateV2TrimMeasurementMode,
  EstimateV2TrimScopeDraft,
  EstimateV2TrimTypeOption,
  EstimateV2TrimUnitType,
  EstimateV2WallPrimeMode,
  EstimateV2WallScopeDraft,
  EstimateV2WallScopeMode,
  EstimateV2WallSegmentDraft,
  EstimateV2WallSegmentShape,
  UnsafeRecord,
} from '../../../../../../types/estimator/v2.ts'

const DEFAULT_COLOR_CODE_ID = 'COLOR1'

export function createUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function numberOrNull(value: string) {
  return asNullableNumber(value)
}

export function unknownNumberOrNull(value: unknown) {
  return asNullableNumber(value)
}

export function toInputNumber(value: unknown) {
  if (value == null || value === '') return ''
  const n = Number(value)
  return Number.isFinite(n) ? String(n) : ''
}

export function toDisplayNumber(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '--'
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return 'No activity yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function toPositiveFactorString(value: unknown, fallback = '1') {
  const parsed = unknownNumberOrNull(value)
  if (parsed == null || parsed <= 0) return fallback
  return toInputNumber(parsed) || fallback
}

export function isCrownTrimType(
  typeMeta: EstimateV2TrimTypeOption | null | undefined,
  scope: EstimateV2TrimScopeDraft | null | undefined
) {
  const values = [
    typeMeta?.category,
    typeMeta?.family,
    typeMeta?.label,
    scope?.trimFamily,
    scope?.scopeName,
    scope?.trimTypeId,
  ]
  return values.some((value) => asText(value).toLowerCase().includes('crown'))
}

export function inferTrimUnitTypeFromText(value: string): EstimateV2TrimUnitType {
  const text = asText(value).toUpperCase()
  if (text.includes(' EA') || text.endsWith('EA')) return 'EA'
  if (text.includes(' SF') || text.endsWith('SF')) return 'SF'
  return 'LF'
}

export function resolveRoomModeById(params: {
  rooms: EstimateV2RoomDraft[]
  wallScopes: EstimateV2WallScopeDraft[]
  ceilingScopes: EstimateV2CeilingScopeDraft[]
}) {
  const roomMode = new Map<string, 'RECT' | 'SEG'>()
  for (const scope of params.wallScopes) {
    if (roomMode.has(scope.roomId)) continue
    roomMode.set(scope.roomId, scope.mode)
  }
  for (const scope of params.ceilingScopes) {
    if (roomMode.has(scope.roomId)) continue
    roomMode.set(scope.roomId, scope.mode)
  }
  for (const room of params.rooms) {
    if (!roomMode.has(room.roomId)) {
      roomMode.set(room.roomId, 'RECT')
    }
  }
  return roomMode
}

export function nextRoomCode(rooms: EstimateV2RoomDraft[]) {
  const used = new Set(rooms.map((room) => room.roomId))
  let n = 1
  while (used.has(`R${String(n).padStart(3, '0')}`)) {
    n += 1
  }
  return `R${String(n).padStart(3, '0')}`
}

export function createDefaultRoom(existingRooms: EstimateV2RoomDraft[]): EstimateV2RoomDraft {
  return {
    id: createUuid(),
    roomId: nextRoomCode(existingRooms),
    roomName: `Room ${existingRooms.length + 1}`,
    roomTypeId: '',
    lengthIn: '',
    widthIn: '',
    heightIn: '',
    wallComplexityId: '',
    notes: '',
    position: existingRooms.length,
  }
}

export function createDefaultScope(roomId: string, mode: EstimateV2WallScopeMode): EstimateV2WallScopeDraft {
  return {
    id: createUuid(),
    roomId,
    position: 0,
    mode,
    include: 'Y',
    scopeName: '',
    colorId: DEFAULT_COLOR_CODE_ID,
    paintProductId: '',
    primerProductId: '',
    primeMode: 'NONE',
    heightIn: '',
    perimeterIn: '',
    standardDoorCount: '',
    standardWindowCount: '',
    heightFactor: '1',
    complexityFactor: '1',
    wallFlagFactor: '1',
    cutInTopFactor: '1',
    cutInBottomFactor: '1',
    paintCoats: '2',
    primerCoats: '1',
    spotPrimePercent: '',
    overrideAreaSqFt: '',
    overridePaintHours: '',
    overridePrimerHours: '',
    overridePaintGallons: '',
    overridePrimerGallons: '',
    overrideSupplyCost: '',
    overrideTotal: '',
    notes: '',
  }
}

export function createDefaultSegment(roomId: string, wallScopeId: string): EstimateV2WallSegmentDraft {
  return {
    id: createUuid(),
    wallScopeId,
    roomId,
    position: 0,
    segmentName: '',
    include: 'Y',
    shapeType: 'RECTANGLE',
    quantity: '1',
    widthIn: '',
    heightIn: '',
    baseIn: '',
    manualAreaSqFt: '',
    standardDoorCount: '',
    standardWindowCount: '',
    overrideAreaSqFt: '',
    notes: '',
  }
}

export function normalizeRoom(row: UnsafeRecord, index: number): EstimateV2RoomDraft {
  return {
    id: asText(row.id) || createUuid(),
    roomId: asText(row.room_id).toUpperCase() || `R${String(index + 1).padStart(3, '0')}`,
    roomName: asText(row.room_name) || `Room ${index + 1}`,
    roomTypeId: asText(row.room_type_id).toUpperCase(),
    lengthIn: toInputNumber(row.length_in),
    widthIn: toInputNumber(row.width_in),
    heightIn: toInputNumber(row.wallheight_in ?? row.height_in),
    wallComplexityId: asText(row.wall_complexity_id || row.wall_complexity_type_id).toUpperCase(),
    notes: asText(row.notes),
    position: Number.isFinite(Number(row.position)) ? Number(row.position) : index,
  }
}

export function normalizeRoomFlag(row: UnsafeRecord, index: number): EstimateV2RoomFlagDraft | null {
  const roomId = asText(row.room_id).toUpperCase()
  const flagId = asText(row.flag_id).toUpperCase()
  if (!roomId || !flagId) return null
  return {
    id: asText(row.id) || createUuid(),
    roomId,
    flagId,
    position: Number.isFinite(Number(row.position)) ? Number(row.position) : index,
  }
}

function parseRollerScope(value: unknown): EstimateV2RollerScope {
  const raw = asText(value).toLowerCase()
  if (raw.startsWith('ceil')) return 'Ceiling'
  if (raw.startsWith('trim')) return 'Trim'
  return 'Wall'
}

export function normalizeRoller(row: UnsafeRecord, index: number): EstimateV2RollerDraft | null {
  const scope = parseRollerScope(row.scope)
  const wallColorId = asText(row.wall_color_id).toUpperCase()
  if (scope === 'Wall' && !wallColorId) return null
  return {
    id: asText(row.id) || createUuid(),
    scope,
    wallColorId,
    rollerSizeIn: toInputNumber(row.roller_size_in),
    coversQty: toInputNumber(row.covers_qty),
    notes: asText(row.notes),
    position: Number.isFinite(Number(row.position)) ? Number(row.position) : index,
  }
}

function parseWallPrimeMode(value: unknown): EstimateV2WallPrimeMode {
  const raw = asText(value).toUpperCase()
  if (raw === 'SPOT') return 'SPOT'
  if (raw === 'FULL') return 'FULL'
  return 'NONE'
}

function parseWallSegmentShape(value: unknown): EstimateV2WallSegmentShape {
  const raw = asText(value).toUpperCase()
  if (raw === 'TRIANGLE') return 'TRIANGLE'
  if (raw === 'MANUAL') return 'MANUAL'
  return 'RECTANGLE'
}

export function normalizeScope(row: UnsafeRecord, index: number): EstimateV2WallScopeDraft {
  return {
    id: asText(row.id) || createUuid(),
    roomId: asText(row.room_id).toUpperCase(),
    position: Number.isFinite(Number(row.position)) ? Number(row.position) : index,
    mode: asText(row.mode).toUpperCase() === 'SEG' ? 'SEG' : 'RECT',
    include: asText(row.include).toUpperCase() === 'N' ? 'N' : 'Y',
    scopeName: asText(row.scope_name),
    colorId: asText(row.color_id).toUpperCase(),
    paintProductId: asText(row.paint_product_id),
    primerProductId: asText(row.primer_product_id),
    primeMode: parseWallPrimeMode(row.prime_mode),
    heightIn: toInputNumber(row.height_in),
    perimeterIn: toInputNumber(row.perimeter_in),
    standardDoorCount: toInputNumber(row.standard_door_count),
    standardWindowCount: toInputNumber(row.standard_window_count),
    heightFactor: toInputNumber(row.height_factor || 1) || '1',
    complexityFactor: toInputNumber(row.complexity_factor || 1) || '1',
    wallFlagFactor: toInputNumber(row.wall_flag_factor || 1) || '1',
    cutInTopFactor: toInputNumber(row.cut_in_top_factor || 1) || '1',
    cutInBottomFactor: toInputNumber(row.cut_in_bottom_factor || 1) || '1',
    paintCoats: toPositiveFactorString(row.paint_coats ?? row.wall_coats ?? row.walls_topcoats, '2'),
    primerCoats: toPositiveFactorString(row.primer_coats ?? row.wall_primer_coats, '1'),
    spotPrimePercent: toInputNumber(row.spot_prime_percent ?? row.wall_spot_prime_pct),
    overrideAreaSqFt: toInputNumber(row.override_area_sf),
    overridePaintHours: toInputNumber(row.override_paint_hours),
    overridePrimerHours: toInputNumber(row.override_primer_hours),
    overridePaintGallons: toInputNumber(row.override_paint_gallons),
    overridePrimerGallons: toInputNumber(row.override_primer_gallons),
    overrideSupplyCost: toInputNumber(row.override_supply_cost),
    overrideTotal: toInputNumber(row.override_total),
    notes: asText(row.notes),
  }
}

export function normalizeSegment(row: UnsafeRecord, index: number): EstimateV2WallSegmentDraft {
  return {
    id: asText(row.id) || createUuid(),
    wallScopeId: asText(row.wall_scope_id),
    roomId: asText(row.room_id).toUpperCase(),
    position: Number.isFinite(Number(row.position)) ? Number(row.position) : index,
    segmentName: asText(row.segment_name),
    include: asText(row.include).toUpperCase() === 'N' ? 'N' : 'Y',
    shapeType: parseWallSegmentShape(row.shape_type),
    quantity: toInputNumber(row.quantity || 1) || '1',
    widthIn: toInputNumber(row.width_in),
    heightIn: toInputNumber(row.height_in),
    baseIn: toInputNumber(row.base_in),
    manualAreaSqFt: toInputNumber(row.manual_area_sf),
    standardDoorCount: toInputNumber(row.standard_door_count),
    standardWindowCount: toInputNumber(row.standard_window_count),
    overrideAreaSqFt: toInputNumber(row.override_area_sf),
    notes: asText(row.notes),
  }
}

export function createDefaultCeilingScope(
  roomId: string,
  mode: EstimateV2CeilingScopeMode
): EstimateV2CeilingScopeDraft {
  return {
    id: createUuid(),
    roomId,
    position: 0,
    mode,
    include: 'Y',
    scopeName: '',
    colorId: '',
    paintProductId: '',
    primerProductId: '',
    primeMode: 'NONE',
    spotPrimePercent: '',
    ceilingTypeId: '',
    lengthIn: '',
    widthIn: '',
    areaSf: '',
    heightFactor: '1',
    complexityFactor: '1',
    ceilingFlagFactor: '1',
    paintCoats: '2',
    primerCoats: '1',
    overrideAreaSqFt: '',
    overridePaintHours: '',
    overridePrimerHours: '',
    overridePaintGallons: '',
    overridePrimerGallons: '',
    overrideSupplyCost: '',
    overrideTotal: '',
    notes: '',
  }
}

export function createDefaultCeilingSegment(
  roomId: string,
  ceilingScopeId: string
): EstimateV2CeilingSegmentDraft {
  return {
    id: createUuid(),
    ceilingScopeId,
    roomId,
    position: 0,
    segmentName: '',
    include: 'Y',
    shapeType: 'RECTANGLE',
    quantity: '1',
    widthIn: '',
    heightIn: '',
    baseIn: '',
    manualAreaSqFt: '',
    overrideAreaSqFt: '',
    notes: '',
  }
}

function parseCeilingPrimeMode(value: unknown): EstimateV2CeilingPrimeMode {
  const raw = asText(value).toUpperCase()
  if (raw === 'SPOT') return 'SPOT'
  if (raw === 'FULL') return 'FULL'
  return 'NONE'
}

function parseCeilingSegmentShape(value: unknown): EstimateV2CeilingSegmentShape {
  const raw = asText(value).toUpperCase()
  if (raw === 'TRIANGLE') return 'TRIANGLE'
  if (raw === 'MANUAL') return 'MANUAL'
  return 'RECTANGLE'
}

export function normalizeCeilingScope(row: UnsafeRecord, index: number): EstimateV2CeilingScopeDraft {
  return {
    id: asText(row.id) || createUuid(),
    roomId: asText(row.room_id).toUpperCase(),
    position: Number.isFinite(Number(row.position)) ? Number(row.position) : index,
    mode: asText(row.mode).toUpperCase() === 'SEG' ? 'SEG' : 'RECT',
    include: asText(row.include).toUpperCase() === 'N' ? 'N' : 'Y',
    scopeName: asText(row.scope_name),
    colorId: asText(row.color_id).toUpperCase(),
    paintProductId: asText(row.paint_product_id),
    primerProductId: asText(row.primer_product_id),
    primeMode: parseCeilingPrimeMode(row.prime_mode),
    spotPrimePercent: toInputNumber(row.spot_prime_percent),
    ceilingTypeId: asText(row.ceiling_type_id).toUpperCase(),
    lengthIn: toInputNumber(row.length_in),
    widthIn: toInputNumber(row.width_in),
    areaSf: toInputNumber(row.area_sf),
    heightFactor: toPositiveFactorString(row.height_factor, '1'),
    complexityFactor: toPositiveFactorString(row.complexity_factor, '1'),
    ceilingFlagFactor: toPositiveFactorString(row.ceiling_flag_factor, '1'),
    paintCoats: toPositiveFactorString(row.paint_coats, '2'),
    primerCoats: toPositiveFactorString(row.primer_coats, '1'),
    overrideAreaSqFt: toInputNumber(row.override_area_sf),
    overridePaintHours: toInputNumber(row.override_paint_hours),
    overridePrimerHours: toInputNumber(row.override_primer_hours),
    overridePaintGallons: toInputNumber(row.override_paint_gallons),
    overridePrimerGallons: toInputNumber(row.override_primer_gallons),
    overrideSupplyCost: toInputNumber(row.override_supply_cost),
    overrideTotal: toInputNumber(row.override_total),
    notes: asText(row.notes),
  }
}

export function normalizeCeilingSegment(row: UnsafeRecord, index: number): EstimateV2CeilingSegmentDraft {
  return {
    id: asText(row.id) || createUuid(),
    ceilingScopeId: asText(row.ceiling_scope_id),
    roomId: asText(row.room_id).toUpperCase(),
    position: Number.isFinite(Number(row.position)) ? Number(row.position) : index,
    segmentName: asText(row.segment_name),
    include: asText(row.include).toUpperCase() === 'N' ? 'N' : 'Y',
    shapeType: parseCeilingSegmentShape(row.shape_type),
    quantity: toInputNumber(row.quantity || 1) || '1',
    widthIn: toInputNumber(row.width_in),
    heightIn: toInputNumber(row.height_in),
    baseIn: toInputNumber(row.base_in),
    manualAreaSqFt: toInputNumber(row.manual_area_sf),
    overrideAreaSqFt: toInputNumber(row.override_area_sf),
    notes: asText(row.notes),
  }
}

export function createDefaultTrimScope(roomId: string): EstimateV2TrimScopeDraft {
  return {
    id: createUuid(),
    roomId,
    position: 0,
    include: 'Y',
    scopeName: '',
    trimTypeId: '',
    trimFamily: '',
    unitType: 'LF',
    measurementMode: 'MANUAL',
    helperSource: '',
    measurementValue: '',
    helperValue: '',
    colorId: '',
    paintProductId: '',
    primerProductId: '',
    paintEnabled: 'Y',
    primeMode: 'NONE',
    spotPrimePercent: '',
    productionRateId: '',
    prepFactor: '1',
    heightFactor: '1',
    profileFactor: '1',
    roomFlagFactor: '1',
    maskingFactor: '1',
    stairFactor: '1',
    difficultFinishFactor: '1',
    caulkFillFactor: '1',
    paintCoats: '2',
    primerCoats: '1',
    overrideMeasurement: '',
    overrideHours: '',
    overrideGallons: '',
    overrideSupplyCost: '',
    overrideTotal: '',
    overrideDescription: '',
    notes: '',
  }
}

function parseTrimMeasurementMode(value: unknown): EstimateV2TrimMeasurementMode {
  return asText(value).toUpperCase() === 'ROOM_HELPER' ? 'ROOM_HELPER' : 'MANUAL'
}

export function normalizeTrimScope(row: UnsafeRecord, index: number): EstimateV2TrimScopeDraft {
  const primeModeRaw = asText(row.prime_mode).toUpperCase()
  const unitRaw = asText(row.unit_type || row.unit).toUpperCase()
  return {
    id: asText(row.id) || createUuid(),
    roomId: asText(row.room_id).toUpperCase(),
    position: Number.isFinite(Number(row.position)) ? Number(row.position) : index,
    include: asText(row.include).toUpperCase() === 'N' ? 'N' : 'Y',
    scopeName: asText(row.scope_name),
    trimTypeId: asText(row.trim_type_id || row.trim_menu_id).toUpperCase(),
    trimFamily: asText(row.trim_family || row.category).toUpperCase(),
    unitType: unitRaw === 'EA' ? 'EA' : unitRaw === 'SF' ? 'SF' : 'LF',
    measurementMode: parseTrimMeasurementMode(row.measurement_mode),
    helperSource: asText(row.helper_source).toUpperCase() === 'ROOM_PERIMETER' ? 'ROOM_PERIMETER' : '',
    measurementValue: toInputNumber(row.measurement_value ?? row.qty),
    helperValue: toInputNumber(row.helper_value),
    colorId: asText(row.color_id).toUpperCase(),
    paintProductId: asText(row.paint_product_id),
    primerProductId: asText(row.primer_product_id),
    paintEnabled: asText(row.paint_enabled).toUpperCase() === 'N' ? 'N' : 'Y',
    primeMode: primeModeRaw === 'SPOT' ? 'SPOT' : primeModeRaw === 'FULL' ? 'FULL' : 'NONE',
    spotPrimePercent: toInputNumber(row.spot_prime_percent),
    productionRateId: asText(row.production_rate_id).toUpperCase(),
    prepFactor: toPositiveFactorString(row.prep_factor, '1'),
    heightFactor: toPositiveFactorString(row.height_factor, '1'),
    profileFactor: toPositiveFactorString(row.profile_factor, '1'),
    roomFlagFactor: toPositiveFactorString(row.room_flag_factor, '1'),
    maskingFactor: toPositiveFactorString(row.masking_factor, '1'),
    stairFactor: toPositiveFactorString(row.stair_factor, '1'),
    difficultFinishFactor: toPositiveFactorString(row.difficult_finish_factor, '1'),
    caulkFillFactor: toPositiveFactorString(row.caulk_fill_factor, '1'),
    paintCoats: toPositiveFactorString(row.paint_coats, '2'),
    primerCoats: toPositiveFactorString(row.primer_coats, '1'),
    overrideMeasurement: toInputNumber(row.override_measurement),
    overrideHours: toInputNumber(row.override_hours),
    overrideGallons: toInputNumber(row.override_gallons),
    overrideSupplyCost: toInputNumber(row.override_supply_cost),
    overrideTotal: toInputNumber(row.override_total),
    overrideDescription: asText(row.override_description),
    notes: asText(row.notes),
  }
}

export function moveItem<T>(rows: T[], from: number, to: number) {
  if (to < 0 || to >= rows.length) return rows
  const next = [...rows]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}
