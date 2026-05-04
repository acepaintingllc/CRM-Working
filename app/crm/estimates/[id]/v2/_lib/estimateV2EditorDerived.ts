import { resolveHeightFactorMultiplierFromInches } from '../../../../../../lib/estimator/heightFactors.ts'
import {
  deriveEstimateV2Scope as deriveScope,
  deriveEstimateV2Segment as deriveSegment,
  sortByPosition,
} from '../../../../../../lib/estimator/v2DraftPayload.ts'
import { asText } from '../../../../../../lib/estimator/parsing.ts'
import {
  numberOrNull,
  toPositiveFactorString,
  unknownNumberOrNull,
} from './estimateV2EditorNormalize.ts'
import type {
  EstimateV2CeilingScopeDraft,
  EstimateV2CeilingSegmentDraft,
  EstimateV2DoorScopeDraft,
  EstimateV2DrywallRepairDraft,
  EstimateV2HeightFactorOption,
  EstimateV2PaintProductOption,
  EstimateV2ProductionRateOption,
  EstimateV2RoomDraft,
  EstimateV2RoomFlagDraft,
  EstimateV2RoomFlagOption,
  EstimateV2TrimScopeDraft,
  EstimateV2WallCalculationsPayload,
  EstimateV2WallScopeDraft,
  EstimateV2WallSegmentDraft,
  UnsafeRecord as Unsafe,
} from '../../../../../../types/estimator/v2.ts'

type RoomPositioned = { roomId: string; position: number }

type RoomFactorMetric = 'wall_factor' | 'ceil_factor' | 'trim_factor'

function groupRowsByRoomId<T extends RoomPositioned>(rows: T[]) {
  const next = new Map<string, T[]>()
  for (const row of rows) {
    const list = next.get(row.roomId)
    if (list) {
      list.push(row)
    } else {
      next.set(row.roomId, [row])
    }
  }
  for (const [roomId, roomRows] of next.entries()) {
    next.set(roomId, sortByPosition(roomRows))
  }
  return next
}

export function buildWallScopeByRoomId(scopes: EstimateV2WallScopeDraft[]) {
  return groupRowsByRoomId(scopes)
}

export function buildCeilingScopeByRoomId(scopes: EstimateV2CeilingScopeDraft[]) {
  return groupRowsByRoomId(scopes)
}

export function buildTrimScopeByRoomId(scopes: EstimateV2TrimScopeDraft[]) {
  return groupRowsByRoomId(scopes)
}

export function buildDoorScopeByRoomId(scopes: EstimateV2DoorScopeDraft[]) {
  return groupRowsByRoomId(scopes)
}

export function buildDrywallRepairByRoomId(scopes: EstimateV2DrywallRepairDraft[]) {
  return groupRowsByRoomId(scopes)
}

export function buildProductionRateById(options: EstimateV2ProductionRateOption[]) {
  const next = new Map<string, EstimateV2ProductionRateOption>()
  for (const option of options) {
    next.set(option.id, option)
  }
  return next
}

export function buildRoomFlagById(options: EstimateV2RoomFlagOption[]) {
  const next = new Map<string, EstimateV2RoomFlagOption>()
  for (const option of options) {
    next.set(option.id, option)
  }
  return next
}

export function buildProductLabelById(products: EstimateV2PaintProductOption[]) {
  return new Map(products.map((product) => [product.id, product.label || product.id]))
}

export function buildPaintOptionsByScope(products: EstimateV2PaintProductOption[], scope: 'Walls' | 'Ceilings' | 'Trim') {
  return products.filter(
    (product) => product.type.toLowerCase() !== 'primer' && (!product.scopes || product.scopes.length === 0 || product.scopes.includes(scope))
  )
}

export function buildPrimerOptionsByScope(products: EstimateV2PaintProductOption[], scope: 'Walls' | 'Ceilings' | 'Trim') {
  return products.filter(
    (product) => product.type.toLowerCase().includes('primer') && (!product.scopes || product.scopes.length === 0 || product.scopes.includes(scope))
  )
}

export function buildCeilingScopeEffectiveAreaById(ceilingCalculations: Unsafe | null) {
  const next = new Map<string, number | null>()
  const calcScopes =
    ceilingCalculations && typeof ceilingCalculations === 'object' && Array.isArray((ceilingCalculations as Unsafe).scopes)
      ? ((ceilingCalculations as Unsafe).scopes as Unsafe[])
      : []
  for (const scope of calcScopes) {
    const scopeId = asText(scope.id)
    if (!scopeId) continue
    next.set(scopeId, unknownNumberOrNull(scope.effective_area_sf))
  }
  return next
}

export function buildCeilingScopeEffectiveTotalById(ceilingCalculations: Unsafe | null) {
  const next = new Map<string, number | null>()
  const calcScopes =
    ceilingCalculations && typeof ceilingCalculations === 'object' && Array.isArray((ceilingCalculations as Unsafe).scopes)
      ? ((ceilingCalculations as Unsafe).scopes as Unsafe[])
      : []
  for (const scope of calcScopes) {
    const scopeId = asText(scope.id)
    if (!scopeId) continue
    next.set(scopeId, unknownNumberOrNull(scope.effective_total))
  }
  return next
}

export function buildTrimScopeMetricById(
  trimCalculations: Unsafe | null,
  key: 'effective_measurement' | 'effective_units' | 'effective_quantity' | 'effective_total'
) {
  const next = new Map<string, number | null>()
  const calcScopes =
    trimCalculations && typeof trimCalculations === 'object' && Array.isArray((trimCalculations as Unsafe).scopes)
      ? ((trimCalculations as Unsafe).scopes as Unsafe[])
      : []
  for (const scope of calcScopes) {
    const scopeId = asText(scope.id)
    if (!scopeId) continue
    next.set(scopeId, unknownNumberOrNull(scope[key]))
  }
  return next
}

function buildTrimCalculationScopeById(trimCalculations: Unsafe | null) {
  const next = new Map<string, Unsafe>()
  const calcScopes =
    trimCalculations && typeof trimCalculations === 'object' && Array.isArray((trimCalculations as Unsafe).scopes)
      ? ((trimCalculations as Unsafe).scopes as Unsafe[])
      : []
  for (const scope of calcScopes) {
    const scopeId = asText(scope.id)
    if (!scopeId) continue
    next.set(scopeId, scope)
  }
  return next
}

function trimModifierProduct(scope: Pick<
  EstimateV2TrimScopeDraft,
  | 'prepFactor'
  | 'heightFactor'
  | 'profileFactor'
  | 'roomFlagFactor'
  | 'maskingFactor'
  | 'stairFactor'
  | 'difficultFinishFactor'
  | 'caulkFillFactor'
>): number {
  return [
    scope.prepFactor,
    scope.heightFactor,
    scope.profileFactor,
    scope.roomFlagFactor,
    scope.maskingFactor,
    scope.stairFactor,
    scope.difficultFinishFactor,
    scope.caulkFillFactor,
  ].reduce<number>((product, value) => {
    const factor = numberOrNull(value)
    return product * (factor != null && factor > 0 ? factor : 1)
  }, 1)
}

function trimCalculationModifierProduct(scope: Unsafe): number {
  return [
    scope.prep_factor,
    scope.height_factor,
    scope.profile_factor,
    scope.room_flag_factor,
    scope.masking_factor,
    scope.stair_factor,
    scope.difficult_finish_factor,
    scope.caulk_fill_factor,
  ].reduce<number>((product, value) => {
    const factor = unknownNumberOrNull(value)
    return product * (factor != null && factor > 0 ? factor : 1)
  }, 1)
}

function resolveTrimDraftMeasurement(
  scope: EstimateV2TrimScopeDraft,
  roomById: Map<string, EstimateV2RoomDraft>,
  roomModeById: Map<string, 'RECT' | 'SEG'>
) {
  if (scope.include !== 'Y') return 0
  const overrideMeasurement = numberOrNull(scope.overrideMeasurement)
  if (overrideMeasurement != null && overrideMeasurement >= 0) return overrideMeasurement
  if (scope.measurementMode === 'ROOM_HELPER') {
    const explicitHelper = numberOrNull(scope.helperValue)
    if (explicitHelper != null && explicitHelper >= 0) return explicitHelper
    const room = roomById.get(scope.roomId)
    const lengthIn = room ? numberOrNull(room.lengthIn) : null
    const widthIn = room ? numberOrNull(room.widthIn) : null
    if (roomModeById.get(scope.roomId) === 'RECT' && lengthIn != null && widthIn != null) {
      return Math.round(((2 * (lengthIn + widthIn)) / 12) * 10000) / 10000
    }
    return 0
  }
  return Math.max(numberOrNull(scope.measurementValue) ?? 0, 0)
}

export function buildLocalTrimScopeMetricById(params: {
  trimCalculations: Unsafe | null
  trimScopes: EstimateV2TrimScopeDraft[]
  rooms: EstimateV2RoomDraft[]
  roomModeById: Map<string, 'RECT' | 'SEG'>
  key: 'effective_measurement' | 'effective_total'
}) {
  const next = new Map<string, number | null>()
  const calcScopeById = buildTrimCalculationScopeById(params.trimCalculations)
  const roomById = new Map(params.rooms.map((room) => [room.roomId, room] as const))
  const assumptions =
    params.trimCalculations &&
    typeof params.trimCalculations === 'object' &&
    typeof (params.trimCalculations as Unsafe).assumptions === 'object'
      ? ((params.trimCalculations as Unsafe).assumptions as Unsafe)
      : null
  const assumedLaborRate = unknownNumberOrNull(assumptions?.labor_rate_per_hour)

  for (const scope of params.trimScopes) {
    const draftMeasurement = resolveTrimDraftMeasurement(scope, roomById, params.roomModeById)
    if (params.key === 'effective_measurement') {
      next.set(scope.id, draftMeasurement)
      continue
    }

    const overrideTotal = numberOrNull(scope.overrideTotal)
    if (overrideTotal != null && overrideTotal >= 0) {
      next.set(scope.id, overrideTotal)
      continue
    }

    const calcScope = calcScopeById.get(scope.id)
    const savedTotal = calcScope ? unknownNumberOrNull(calcScope.effective_total) : null
    if (savedTotal == null) {
      next.set(scope.id, null)
      continue
    }

    const savedMeasurement = calcScope ? unknownNumberOrNull(calcScope.effective_measurement) : null
    const measurementRatio =
      savedMeasurement != null && savedMeasurement > 0
        ? draftMeasurement / savedMeasurement
        : draftMeasurement === 0
          ? 0
          : 1
    const savedModifier = calcScope ? trimCalculationModifierProduct(calcScope) : 1
    const draftModifier = trimModifierProduct(scope)
    const modifierRatio = savedModifier > 0 ? draftModifier / savedModifier : 1
    const savedPaintHours = calcScope ? unknownNumberOrNull(calcScope.effective_paint_hours) : null
    const savedPrimerHours = calcScope ? unknownNumberOrNull(calcScope.effective_primer_hours) : null
    const savedLaborHours = (savedPaintHours ?? 0) + (savedPrimerHours ?? 0)
    const laborRate =
      (calcScope ? unknownNumberOrNull(calcScope.labor_rate_per_hour) : null) ?? assumedLaborRate
    const savedLaborCost = laborRate != null ? savedLaborHours * laborRate : savedTotal
    const savedNonLaborCost = Math.max(savedTotal - savedLaborCost, 0)
    next.set(
      scope.id,
      Math.round((savedLaborCost * measurementRatio * modifierRatio + savedNonLaborCost * measurementRatio) * 100) / 100
    )
  }
  return next
}

export function buildWallScopeEffectiveTotalById(wallCalculations: EstimateV2WallCalculationsPayload | null) {
  const next = new Map<string, number | null>()
  for (const scope of wallCalculations?.scopes ?? []) {
    const scopeId = asText((scope as Unsafe).id)
    if (!scopeId) continue
    next.set(scopeId, unknownNumberOrNull((scope as Unsafe).effective_total))
  }
  return next
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}

function scaledLocalTotal(params: {
  include: 'Y' | 'N'
  overrideTotal: string
  localMeasurement: number | null | undefined
  savedMeasurement: number | null | undefined
  savedTotal: number | null | undefined
}) {
  if (params.include !== 'Y') return 0
  const overrideTotal = numberOrNull(params.overrideTotal)
  if (overrideTotal != null && overrideTotal >= 0) return overrideTotal
  if (params.localMeasurement == null) return null
  if (params.savedTotal == null) return null
  const savedMeasurement = params.savedMeasurement
  if (savedMeasurement != null && savedMeasurement > 0) {
    return roundCurrency(params.savedTotal * (params.localMeasurement / savedMeasurement))
  }
  return params.localMeasurement === 0 ? 0 : params.savedTotal
}

export function buildLocalWallScopeEffectiveTotalById(params: {
  wallScopes: EstimateV2WallScopeDraft[]
  localScopeEffectiveAreaById: Map<string, number | null>
  savedScopeEffectiveAreaById: Map<string, number | null>
  savedScopeEffectiveTotalById: Map<string, number | null>
}) {
  const next = new Map<string, number | null>()
  for (const scope of params.wallScopes) {
    next.set(
      scope.id,
      scaledLocalTotal({
        include: scope.include,
        overrideTotal: scope.overrideTotal,
        localMeasurement: params.localScopeEffectiveAreaById.get(scope.id),
        savedMeasurement: params.savedScopeEffectiveAreaById.get(scope.id),
        savedTotal: params.savedScopeEffectiveTotalById.get(scope.id),
      })
    )
  }
  return next
}

export function buildWallScopeEffectiveAreaById(wallCalculations: EstimateV2WallCalculationsPayload | null) {
  const next = new Map<string, number | null>()
  for (const trace of wallCalculations?.scope_traces ?? []) {
    const scopeId = asText(trace.scope_id)
    if (!scopeId) continue
    next.set(scopeId, unknownNumberOrNull(trace.area?.effective_area_sf))
  }
  for (const scope of wallCalculations?.scopes ?? []) {
    const scopeId = asText((scope as Unsafe).id)
    if (!scopeId || next.has(scopeId)) continue
    next.set(scopeId, unknownNumberOrNull((scope as Unsafe).effective_area_sf))
  }
  return next
}

export function buildWallSegmentEffectiveAreaById(wallCalculations: EstimateV2WallCalculationsPayload | null) {
  const next = new Map<string, number | null>()
  for (const segment of wallCalculations?.segments ?? []) {
    const segmentId = asText((segment as Unsafe).id)
    if (!segmentId) continue
    next.set(segmentId, unknownNumberOrNull((segment as Unsafe).effective_area_sf))
  }
  return next
}

export function buildWallRoomEffectiveAreaByRoomId(wallCalculations: EstimateV2WallCalculationsPayload | null) {
  const next = new Map<string, number | null>()
  for (const total of wallCalculations?.room_totals ?? []) {
    const roomId = asText(total.room_id).toUpperCase()
    if (!roomId) continue
    next.set(roomId, unknownNumberOrNull(total.effective_area_sf))
  }
  return next
}

export function buildLocalSegmentEffectiveAreaById(segments: EstimateV2WallSegmentDraft[]) {
  const next = new Map<string, number | null>()
  for (const segment of segments) {
    next.set(segment.id, deriveSegment(segment).effectiveArea)
  }
  return next
}

export function buildLocalScopeEffectiveAreaById(
  scopes: EstimateV2WallScopeDraft[],
  segments: EstimateV2WallSegmentDraft[]
) {
  const next = new Map<string, number | null>()
  for (const scope of scopes) {
    const scopeSegments = sortByPosition(segments.filter((segment) => segment.wallScopeId === scope.id))
    next.set(scope.id, deriveScope(scope, scopeSegments).effectiveArea)
  }
  return next
}

export function buildLocalRoomEffectiveAreaByRoomId(
  rooms: EstimateV2RoomDraft[],
  scopes: EstimateV2WallScopeDraft[],
  localScopeEffectiveAreaById: Map<string, number | null>
) {
  const next = new Map<string, number | null>()
  for (const room of rooms) {
    const roomScopes = sortByPosition(scopes.filter((scope) => scope.roomId === room.roomId))
    const total = roomScopes.reduce((sum, scope) => {
      if (scope.include !== 'Y') return sum
      return sum + (localScopeEffectiveAreaById.get(scope.id) ?? 0)
    }, 0)
    next.set(room.roomId, total)
  }
  return next
}

function ceilingSegmentEffectiveArea(segment: EstimateV2CeilingSegmentDraft) {
  if (segment.include !== 'Y') return 0
  const quantity = numberOrNull(segment.quantity) ?? 1
  if (quantity <= 0) return null
  let geometry: number | null = null
  if (segment.shapeType === 'RECTANGLE') {
    const width = numberOrNull(segment.widthIn)
    const height = numberOrNull(segment.heightIn)
    geometry = width != null && height != null ? (width * height * quantity) / 144 : null
  } else if (segment.shapeType === 'TRIANGLE') {
    const base = numberOrNull(segment.baseIn)
    const height = numberOrNull(segment.heightIn)
    geometry = base != null && height != null ? ((base * height) / 2 / 144) * quantity : null
  } else {
    const manual = numberOrNull(segment.manualAreaSqFt)
    geometry = manual != null ? manual * quantity : null
  }
  const override = numberOrNull(segment.overrideAreaSqFt)
  return override ?? geometry
}

function vaultedMeasuredArea(scope: EstimateV2CeilingScopeDraft, room: EstimateV2RoomDraft | null) {
  const ridgeLength =
    numberOrNull(scope.vaultedRidgeLengthIn ?? '') ??
    numberOrNull(scope.lengthIn ?? '') ??
    numberOrNull(room?.lengthIn ?? '')
  const slopeLength = numberOrNull(scope.vaultedSlopeLengthIn ?? '')
  const planeCount = numberOrNull(scope.vaultedPlaneCount ?? '')
  return ridgeLength != null && slopeLength != null && planeCount != null && planeCount > 0
    ? (ridgeLength * slopeLength * Math.floor(planeCount)) / 144
    : null
}

function ceilingBaseArea(
  scope: EstimateV2CeilingScopeDraft,
  room: EstimateV2RoomDraft | null,
  segments: EstimateV2CeilingSegmentDraft[]
) {
  if (scope.mode === 'SEG') {
    let total = 0
    for (const segment of segments) {
      const area = ceilingSegmentEffectiveArea(segment)
      if (area == null) return null
      total += area
    }
    return Math.round(total * 10000) / 10000
  }
  const direct = numberOrNull(scope.areaSf)
  if (direct != null) return direct
  if ((scope.ceilingGeometryMode || 'FLAT') === 'VAULTED') {
    const vaultedArea = vaultedMeasuredArea(scope, room)
    if (vaultedArea != null) return vaultedArea
  }
  const length = numberOrNull(scope.lengthIn) ?? numberOrNull(room?.lengthIn ?? '')
  const width = numberOrNull(scope.widthIn) ?? numberOrNull(room?.widthIn ?? '')
  return length != null && width != null ? (length * width) / 144 : null
}

function ceilingHelperExtraArea(scope: EstimateV2CeilingScopeDraft, baseArea: number | null) {
  const base = baseArea ?? 0
  if (base <= 0) return 0
  if (scope.ceilingGeometryMode === 'VAULTED') {
    if (numberOrNull(scope.areaSf) != null) return 0
    if (vaultedMeasuredArea(scope, null) != null) return 0
    const factor = numberOrNull(scope.vaultedAreaFactor ?? '')
    return factor != null && factor > 0 ? Math.max(base * factor - base, 0) : null
  }
  if (scope.ceilingGeometryMode === 'COFFERED') {
    const sectionLength = numberOrNull(scope.cofferSectionLengthIn ?? '') ?? 0
    const sectionWidth = numberOrNull(scope.cofferSectionWidthIn ?? '') ?? 0
    const sectionCount = Math.max(0, Math.floor(numberOrNull(scope.cofferSectionCount ?? '') ?? 0))
    const faceHeight = numberOrNull(scope.cofferFaceHeightIn ?? '') ?? 0
    const bottomWidth = numberOrNull(scope.cofferBottomWidthIn ?? '') ?? 0
    const sectionPerimeter = 2 * (sectionLength + sectionWidth)
    return sectionCount * ((sectionPerimeter * faceHeight) / 144 + (sectionPerimeter * bottomWidth) / 144)
  }
  return 0
}

export function buildLocalCeilingScopeEffectiveAreaById(params: {
  ceilingScopes: EstimateV2CeilingScopeDraft[]
  ceilingSegments: EstimateV2CeilingSegmentDraft[]
  rooms: EstimateV2RoomDraft[]
}) {
  const next = new Map<string, number | null>()
  const roomById = new Map(params.rooms.map((room) => [room.roomId, room] as const))
  for (const scope of params.ceilingScopes) {
    if (scope.include !== 'Y') {
      next.set(scope.id, 0)
      continue
    }
    const baseArea = ceilingBaseArea(
      scope,
      roomById.get(scope.roomId) ?? null,
      sortByPosition(params.ceilingSegments.filter((segment) => segment.ceilingScopeId === scope.id))
    )
    const helperExtra = ceilingHelperExtraArea(scope, baseArea)
    const override = numberOrNull(scope.overrideAreaSqFt)
    const effective = override ?? (baseArea != null && helperExtra != null ? baseArea + helperExtra : null)
    next.set(scope.id, effective == null ? null : Math.round(effective * 10000) / 10000)
  }
  return next
}

export function buildLocalCeilingScopeEffectiveTotalById(params: {
  ceilingScopes: EstimateV2CeilingScopeDraft[]
  localCeilingScopeEffectiveAreaById: Map<string, number | null>
  savedCeilingScopeEffectiveAreaById: Map<string, number | null>
  savedCeilingScopeEffectiveTotalById: Map<string, number | null>
}) {
  const next = new Map<string, number | null>()
  for (const scope of params.ceilingScopes) {
    next.set(
      scope.id,
      scaledLocalTotal({
        include: scope.include,
        overrideTotal: scope.overrideTotal,
        localMeasurement: params.localCeilingScopeEffectiveAreaById.get(scope.id),
        savedMeasurement: params.savedCeilingScopeEffectiveAreaById.get(scope.id),
        savedTotal: params.savedCeilingScopeEffectiveTotalById.get(scope.id),
      })
    )
  }
  return next
}

export function buildRoomComplexityFactorByRoomId(
  rooms: EstimateV2RoomDraft[],
  wallProductionRateById: Map<string, EstimateV2ProductionRateOption>
) {
  void wallProductionRateById
  const next = new Map<string, string>()
  for (const room of rooms) {
    next.set(room.roomId, '1')
  }
  return next
}

export function buildRoomFlagFactorByRoomId(
  rooms: EstimateV2RoomDraft[],
  roomFlags: EstimateV2RoomFlagDraft[],
  roomFlagById: Map<string, EstimateV2RoomFlagOption>,
  metric: RoomFactorMetric
) {
  const next = new Map<string, string>()
  const selectedByRoomId = new Map<string, EstimateV2RoomFlagDraft[]>()
  for (const flag of roomFlags) {
    const list = selectedByRoomId.get(flag.roomId)
    if (list) {
      list.push(flag)
    } else {
      selectedByRoomId.set(flag.roomId, [flag])
    }
  }
  for (const room of rooms) {
    const selectedFlags = selectedByRoomId.get(room.roomId) ?? []
    let factor = 1
    for (const selectedFlag of selectedFlags) {
      const nextFactor = roomFlagById.get(selectedFlag.flagId)?.[metric]
      if (nextFactor != null && Number.isFinite(nextFactor) && nextFactor > 0) {
        factor *= nextFactor
      }
    }
    next.set(room.roomId, toPositiveFactorString(factor, '1'))
  }
  return next
}

export function buildRoomHeightFactorByRoomId(
  rooms: EstimateV2RoomDraft[],
  heightFactors: EstimateV2HeightFactorOption[]
) {
  const next = new Map<string, string>()
  for (const room of rooms) {
    const heightFactor = resolveHeightFactorMultiplierFromInches(
      numberOrNull(room.heightIn),
      heightFactors,
      1
    )
    next.set(room.roomId, toPositiveFactorString(heightFactor, '1'))
  }
  return next
}

export function sumIncludedValues<T extends { id: string; include: 'Y' | 'N' }>(
  rows: T[],
  valueById: Map<string, number | null>
) {
  let total = 0
  let hasValues = false
  for (const row of rows) {
    if (row.include !== 'Y') continue
    const value = valueById.get(row.id)
    if (value == null) continue
    hasValues = true
    total += value
  }
  return hasValues ? Math.round(total * 100) / 100 : null
}
