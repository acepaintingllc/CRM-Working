import { resolveHeightFactorMultiplierFromInches } from '../../../../../../lib/estimator/heightFactors.ts'
import {
  calculateCeilingScopePreviewAreaBreakdown,
  calculateCeilingScopePreviewEffectiveArea,
  calculateDoorScopePreviewCount,
  calculateDoorScopePreviewEffectiveUnits,
  calculateDrywallRepairPreviewEffectiveQuantity,
  calculatePreviewEffectiveTotal,
  calculateTrimScopePreviewEffectiveMeasurement,
} from '../../../../../../lib/estimator/previewCalculations.ts'
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
import type { UnsafeRecord as Unsafe } from '@/types/estimator/v2Meta'
import type {
  EstimateV2HeightFactorOption,
  EstimateV2PaintProductOption,
  EstimateV2ProductionRateOption,
  EstimateV2RoomFlagOption,
} from '@/types/estimator/v2Catalogs'
import type { EstimateV2RoomDraft, EstimateV2RoomFlagDraft } from '@/types/estimator/v2Rooms'
import type {
  EstimateV2CeilingScopeDraft,
  EstimateV2CeilingSegmentDraft,
  EstimateV2DoorScopeDraft,
  EstimateV2DrywallRepairDraft,
  EstimateV2TrimScopeDraft,
  EstimateV2WallCalculationsPayload,
  EstimateV2WallScopeDraft,
  EstimateV2WallSegmentDraft,
} from '@/types/estimator/v2Scopes'

export type EstimateV2CeilingScopePreviewMetrics = {
  baseAreaSqFt: number | null
  helperExtraAreaSqFt: number
  areaFactor: number
  finalAreaSqFt: number | null
  effectiveAreaSqFt: number | null
}

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

export function buildLocalTrimScopeMetricById(params: {
  trimScopes: EstimateV2TrimScopeDraft[]
  rooms: EstimateV2RoomDraft[]
  roomModeById: Map<string, 'RECT' | 'SEG'>
  key: 'effective_measurement' | 'effective_total'
}) {
  const next = new Map<string, number | null>()
  const roomById = new Map(params.rooms.map((room) => [room.roomId, room] as const))

  for (const scope of params.trimScopes) {
    const room = roomById.get(scope.roomId) ?? null
    const draftMeasurement = calculateTrimScopePreviewEffectiveMeasurement({
      scope: {
        include: scope.include,
        measurementMode: scope.measurementMode,
        helperSource: scope.helperSource,
        measurementValue: scope.measurementValue,
        helperValue: scope.helperValue,
        overrideMeasurement: scope.overrideMeasurement,
      },
      room: room
        ? {
            lengthIn: room.lengthIn,
            widthIn: room.widthIn,
            mode: params.roomModeById.get(scope.roomId) ?? 'SEG',
          }
        : null,
    })
    if (params.key === 'effective_measurement') {
      next.set(scope.id, draftMeasurement)
      continue
    }

    next.set(
      scope.id,
      calculatePreviewEffectiveTotal({
        include: scope.include,
        overrideTotal: scope.overrideTotal,
      })
    )
  }
  return next
}

export function buildLocalDoorScopeEffectiveUnitsById(doorScopes: EstimateV2DoorScopeDraft[]) {
  const next = new Map<string, number | null>()
  for (const scope of doorScopes) {
    next.set(
      scope.id,
      calculateDoorScopePreviewEffectiveUnits({
        include: scope.include,
        quantity: scope.quantity,
        sides: scope.sides,
      })
    )
  }
  return next
}

export function buildLocalDoorScopeEffectiveTotalById(doorScopes: EstimateV2DoorScopeDraft[]) {
  const next = new Map<string, number | null>()
  for (const scope of doorScopes) {
    next.set(
      scope.id,
      calculatePreviewEffectiveTotal({
        include: scope.include,
        overrideTotal: scope.overrideTotal,
      })
    )
  }
  return next
}

export function buildDoorScopeCountById(doorScopes: EstimateV2DoorScopeDraft[]) {
  const next = new Map<string, number | null>()
  for (const scope of doorScopes) {
    next.set(
      scope.id,
      calculateDoorScopePreviewCount({
        include: scope.include,
        quantity: scope.quantity,
      })
    )
  }
  return next
}

export function buildLocalDrywallRepairEffectiveQuantityById(repairs: EstimateV2DrywallRepairDraft[]) {
  const next = new Map<string, number | null>()
  for (const repair of repairs) {
    next.set(
      repair.id,
      calculateDrywallRepairPreviewEffectiveQuantity({
        quantity: repair.quantity,
      })
    )
  }
  return next
}

export function buildLocalDrywallRepairEffectiveTotalById(repairs: EstimateV2DrywallRepairDraft[]) {
  const next = new Map<string, number | null>()
  for (const repair of repairs) {
    next.set(
      repair.id,
      calculatePreviewEffectiveTotal({
        include: 'Y',
        overrideTotal: repair.overrideTotal,
      })
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

export function buildLocalWallScopeEffectiveTotalById(params: {
  wallScopes: EstimateV2WallScopeDraft[]
}) {
  const next = new Map<string, number | null>()
  for (const scope of params.wallScopes) {
    next.set(
      scope.id,
      calculatePreviewEffectiveTotal({
        include: scope.include,
        overrideTotal: scope.overrideTotal,
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

export function buildLocalCeilingScopeEffectiveAreaById(params: {
  ceilingScopes: EstimateV2CeilingScopeDraft[]
  ceilingSegments: EstimateV2CeilingSegmentDraft[]
  rooms: EstimateV2RoomDraft[]
  ceilingTypes?: Array<{ id: string; area_factor?: number | null; areaFactor?: number | null }>
}) {
  const next = new Map<string, number | null>()
  const roomById = new Map(params.rooms.map((room) => [room.roomId, room] as const))
  for (const scope of params.ceilingScopes) {
    const room = roomById.get(scope.roomId) ?? null
    next.set(
      scope.id,
      calculateCeilingScopePreviewEffectiveArea({
        scope,
        room,
        segments: sortByPosition(params.ceilingSegments.filter((segment) => segment.ceilingScopeId === scope.id)),
        ceilingTypes: params.ceilingTypes,
      })
    )
  }
  return next
}

export function buildLocalCeilingScopePreviewMetricsById(params: {
  ceilingScopes: EstimateV2CeilingScopeDraft[]
  ceilingSegments: EstimateV2CeilingSegmentDraft[]
  rooms: EstimateV2RoomDraft[]
  ceilingTypes?: Array<{ id: string; area_factor?: number | null; areaFactor?: number | null }>
}) {
  const next = new Map<string, EstimateV2CeilingScopePreviewMetrics>()
  const roomById = new Map(params.rooms.map((room) => [room.roomId, room] as const))
  for (const scope of params.ceilingScopes) {
    const room = roomById.get(scope.roomId) ?? null
    const breakdown = calculateCeilingScopePreviewAreaBreakdown({
      scope,
      room,
      segments: sortByPosition(params.ceilingSegments.filter((segment) => segment.ceilingScopeId === scope.id)),
      ceilingTypes: params.ceilingTypes,
    })
    next.set(scope.id, {
      baseAreaSqFt: breakdown.baseArea,
      helperExtraAreaSqFt: breakdown.helperExtraArea,
      areaFactor: breakdown.areaFactor,
      finalAreaSqFt: breakdown.finalArea,
      effectiveAreaSqFt: breakdown.effectiveArea,
    })
  }
  return next
}

export function buildLocalCeilingScopeEffectiveTotalById(params: {
  ceilingScopes: EstimateV2CeilingScopeDraft[]
}) {
  const next = new Map<string, number | null>()
  for (const scope of params.ceilingScopes) {
    next.set(
      scope.id,
      calculatePreviewEffectiveTotal({
        include: scope.include,
        overrideTotal: scope.overrideTotal,
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
