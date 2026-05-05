import { asNullableNumber } from './parsing.ts'
import {
  calculateCeilingHelperExtraArea,
  calculateCeilingSegmentArea,
  calculateDoorBillableUnits,
  calculateDoorCount,
  calculateDrywallEffectiveQuantity,
  calculateRoomPerimeterMeasurement,
  calculateVaultedMeasuredCeilingArea,
  rectangleAreaSqFt,
} from './calculationPrimitives.ts'
import type { YN } from './wallsTypes.ts'

type NumericInput = number | string | null | undefined

export type PreviewEffectiveTotalInput = {
  include: YN
  overrideTotal: NumericInput
}

export type CeilingPreviewRoomInput = {
  lengthIn: NumericInput
  widthIn: NumericInput
}

export type CeilingPreviewScopeInput = {
  include: YN
  mode: 'RECT' | 'SEG'
  lengthIn: NumericInput
  widthIn: NumericInput
  areaSf: NumericInput
  ceilingTypeId?: string | null
  ceilingGeometryMode?: string | null
  vaultedAreaFactor?: NumericInput
  vaultedRidgeLengthIn?: NumericInput
  vaultedSlopeLengthIn?: NumericInput
  vaultedPlaneCount?: NumericInput
  cofferSectionLengthIn?: NumericInput
  cofferSectionWidthIn?: NumericInput
  cofferSectionCount?: NumericInput
  cofferFaceHeightIn?: NumericInput
  cofferBottomWidthIn?: NumericInput
  overrideAreaSqFt: NumericInput
}

export type CeilingPreviewTypeInput = {
  id: string
  area_factor?: NumericInput
  areaFactor?: NumericInput
}

export type CeilingPreviewAreaBreakdown = {
  baseArea: number | null
  helperExtraArea: number
  areaFactor: number
  finalArea: number | null
  effectiveArea: number | null
}

export type CeilingPreviewSegmentInput = {
  include: YN
  shapeType: 'RECTANGLE' | 'TRIANGLE' | 'MANUAL'
  quantity: NumericInput
  widthIn: NumericInput
  heightIn: NumericInput
  baseIn: NumericInput
  manualAreaSqFt: NumericInput
  overrideAreaSqFt: NumericInput
}

export type TrimPreviewRoomInput = {
  lengthIn: NumericInput
  widthIn: NumericInput
  mode: 'RECT' | 'SEG'
}

export type TrimPreviewScopeInput = {
  include: YN
  measurementMode: 'MANUAL' | 'ROOM_HELPER'
  helperSource?: 'ROOM_PERIMETER' | string | null
  measurementValue: NumericInput
  helperValue: NumericInput
  overrideMeasurement: NumericInput
}

export type DoorPreviewScopeInput = {
  include: YN
  quantity: NumericInput
  sides: NumericInput
}

export type DrywallRepairPreviewInput = {
  quantity: NumericInput
}

function numberOrNull(value: NumericInput) {
  return asNullableNumber(value)
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function round4(value: number) {
  return Math.round(value * 10000) / 10000
}

export function calculatePreviewEffectiveTotal(params: PreviewEffectiveTotalInput) {
  if (params.include !== 'Y') return 0
  const overrideTotal = numberOrNull(params.overrideTotal)
  if (overrideTotal != null && overrideTotal >= 0) return overrideTotal
  return null
}

export function calculateCeilingSegmentPreviewEffectiveArea(segment: CeilingPreviewSegmentInput) {
  if (segment.include !== 'Y') return 0
  const quantity = numberOrNull(segment.quantity) ?? 1
  if (quantity <= 0) return null
  const area = calculateCeilingSegmentArea({
    include: segment.include,
    shapeType: segment.shapeType,
    quantity,
    widthIn: segment.widthIn,
    heightIn: segment.heightIn,
    baseIn: segment.baseIn,
    manualAreaSqFt: segment.manualAreaSqFt,
    overrideAreaSqFt: segment.overrideAreaSqFt,
    missingQuantityFallback: 1,
  })
  return numberOrNull(segment.overrideAreaSqFt) ?? area.geometry
}

function calculateVaultedMeasuredPreviewArea(
  scope: Pick<
    CeilingPreviewScopeInput,
    'vaultedRidgeLengthIn' | 'vaultedSlopeLengthIn' | 'vaultedPlaneCount' | 'lengthIn'
  >,
  room: CeilingPreviewRoomInput | null
) {
  return calculateVaultedMeasuredCeilingArea({
    ridgeLengthIn: scope.vaultedRidgeLengthIn ?? scope.lengthIn,
    fallbackLengthIn: room?.lengthIn,
    slopeLengthIn: scope.vaultedSlopeLengthIn,
    planeCount: scope.vaultedPlaneCount,
  })
}

function calculateCeilingPreviewBaseArea(params: {
  scope: CeilingPreviewScopeInput
  room: CeilingPreviewRoomInput | null
  segments: CeilingPreviewSegmentInput[]
}) {
  const { scope, room, segments } = params
  if (scope.mode === 'SEG') {
    let total = 0
    for (const segment of segments) {
      const area = calculateCeilingSegmentPreviewEffectiveArea(segment)
      if (area == null) return null
      total += area
    }
    return round4(total)
  }

  const direct = numberOrNull(scope.areaSf)
  if (direct != null) return direct

  if ((scope.ceilingGeometryMode || 'FLAT') === 'VAULTED') {
    const vaultedArea = calculateVaultedMeasuredPreviewArea(scope, room)
    if (vaultedArea != null) return vaultedArea
  }

  const length = numberOrNull(scope.lengthIn) ?? numberOrNull(room?.lengthIn)
  const width = numberOrNull(scope.widthIn) ?? numberOrNull(room?.widthIn)
  return rectangleAreaSqFt(length, width)
}

function calculateCeilingPreviewHelperExtraArea(
  scope: CeilingPreviewScopeInput,
  room: CeilingPreviewRoomInput | null,
  baseArea: number | null
) {
  const base = baseArea ?? 0
  if (base <= 0) return 0
  return calculateCeilingHelperExtraArea({
    geometryMode: scope.ceilingGeometryMode,
    baseArea,
    directArea: scope.areaSf,
    measuredVaultedArea: calculateVaultedMeasuredPreviewArea(scope, room),
    vaultedAreaFactor: scope.vaultedAreaFactor,
    cofferSectionLengthIn: scope.cofferSectionLengthIn,
    cofferSectionWidthIn: scope.cofferSectionWidthIn,
    cofferSectionCount: scope.cofferSectionCount,
    cofferFaceHeightIn: scope.cofferFaceHeightIn,
    cofferBottomWidthIn: scope.cofferBottomWidthIn,
    missingVaultedFactorResult: null,
  })
}

function resolveCeilingPreviewAreaFactor(params: {
  scope: Pick<CeilingPreviewScopeInput, 'mode' | 'ceilingTypeId'>
  ceilingTypes: CeilingPreviewTypeInput[]
}) {
  if (params.scope.mode === 'SEG' || !params.scope.ceilingTypeId) return 1
  const match = params.ceilingTypes.find((type) => type.id === params.scope.ceilingTypeId)
  const factor = numberOrNull(match?.area_factor ?? match?.areaFactor)
  return factor != null && factor > 0 ? factor : 1
}

export function calculateCeilingScopePreviewAreaBreakdown(params: {
  scope: CeilingPreviewScopeInput
  room?: CeilingPreviewRoomInput | null
  segments?: CeilingPreviewSegmentInput[]
  ceilingTypes?: CeilingPreviewTypeInput[]
}): CeilingPreviewAreaBreakdown {
  const { scope, room = null, segments = [], ceilingTypes = [] } = params
  const areaFactor = resolveCeilingPreviewAreaFactor({ scope, ceilingTypes })
  if (scope.include !== 'Y') {
    return {
      baseArea: null,
      helperExtraArea: 0,
      areaFactor,
      finalArea: 0,
      effectiveArea: 0,
    }
  }

  const baseArea = calculateCeilingPreviewBaseArea({ scope, room, segments })
  const helperExtra = calculateCeilingPreviewHelperExtraArea(scope, room, baseArea)
  const override = numberOrNull(scope.overrideAreaSqFt)
  const finalArea = baseArea != null && helperExtra != null ? round4((baseArea + helperExtra) * areaFactor) : null
  const effective = override ?? finalArea

  return {
    baseArea,
    helperExtraArea: helperExtra ?? 0,
    areaFactor,
    finalArea,
    effectiveArea: effective == null ? null : round4(effective),
  }
}

export function calculateCeilingScopePreviewEffectiveArea(params: {
  scope: CeilingPreviewScopeInput
  room?: CeilingPreviewRoomInput | null
  segments?: CeilingPreviewSegmentInput[]
  ceilingTypes?: CeilingPreviewTypeInput[]
}) {
  return calculateCeilingScopePreviewAreaBreakdown(params).effectiveArea
}

export function calculateTrimScopePreviewEffectiveMeasurement(params: {
  scope: TrimPreviewScopeInput
  room?: TrimPreviewRoomInput | null
}) {
  const { scope, room = null } = params
  if (scope.include !== 'Y') return 0

  const overrideMeasurement = numberOrNull(scope.overrideMeasurement)
  if (overrideMeasurement != null && overrideMeasurement >= 0) return overrideMeasurement

  if (scope.measurementMode === 'ROOM_HELPER') {
    const roomPerimeter = calculateRoomPerimeterMeasurement({
      roomMode: room?.mode,
      lengthIn: room?.lengthIn,
      widthIn: room?.widthIn,
    })
    if (scope.helperSource === 'ROOM_PERIMETER' && roomPerimeter != null) return roomPerimeter

    const explicitHelper = numberOrNull(scope.helperValue)
    if (explicitHelper != null && explicitHelper >= 0) return explicitHelper

    return 0
  }

  return Math.max(numberOrNull(scope.measurementValue) ?? 0, 0)
}

export function calculateDoorScopePreviewEffectiveUnits(scope: DoorPreviewScopeInput) {
  const units = calculateDoorBillableUnits({
    include: scope.include,
    quantity: scope.quantity,
    sides: scope.sides,
    missingQuantityResult: null,
  })
  return units == null ? null : round2(units)
}

export function calculateDoorScopePreviewCount(scope: Pick<DoorPreviewScopeInput, 'include' | 'quantity'>) {
  const count = calculateDoorCount({
    include: scope.include,
    quantity: scope.quantity,
    missingQuantityResult: null,
  })
  return count == null ? null : round2(count)
}

export function calculateDrywallRepairPreviewEffectiveQuantity(repair: DrywallRepairPreviewInput) {
  return calculateDrywallEffectiveQuantity(repair.quantity)
}
