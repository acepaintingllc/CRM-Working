import { n, nonNeg, pos, round4 } from './wallsHelpers.ts'
import type { YN } from './wallsTypes.ts'

export type NumericLike = number | string | null | undefined

export type CeilingSegmentShape = 'RECTANGLE' | 'TRIANGLE' | 'MANUAL'
export type CeilingGeometryMode = 'FLAT' | 'VAULTED' | 'TRAY' | 'COFFERED' | 'MANUAL'

export function numeric(value: NumericLike) {
  return n(value)
}

export function nonNegative(value: NumericLike) {
  return nonNeg(n(value))
}

export function positive(value: NumericLike) {
  return pos(n(value))
}

export function rectangleAreaSqFt(lengthIn: NumericLike, widthIn: NumericLike) {
  const length = positive(lengthIn)
  const width = positive(widthIn)
  return length != null && width != null ? round4((length * width) / 144) : null
}

export function calculateCeilingSegmentArea(params: {
  include: YN
  shapeType: CeilingSegmentShape
  quantity: NumericLike
  widthIn: NumericLike
  heightIn: NumericLike
  baseIn: NumericLike
  manualAreaSqFt: NumericLike
  overrideAreaSqFt: NumericLike
  missingQuantityFallback?: number
}) {
  const quantity = positive(params.quantity) ?? params.missingQuantityFallback ?? 0
  let geometry: number | null = null

  if (params.shapeType === 'RECTANGLE') {
    geometry = rectangleAreaSqFt(params.widthIn, params.heightIn)
    geometry = geometry == null ? null : round4(geometry * quantity)
  } else if (params.shapeType === 'TRIANGLE') {
    const base = positive(params.baseIn)
    const height = positive(params.heightIn)
    geometry = base != null && height != null ? round4(((base * height) / 2 / 144) * quantity) : null
  } else {
    const manual = positive(params.manualAreaSqFt)
    geometry = manual != null ? round4(manual * quantity) : null
  }

  const override = nonNegative(params.overrideAreaSqFt)
  const effective = params.include === 'Y' ? round4(override ?? geometry ?? 0) : 0
  return { quantity, geometry, effective }
}

export function calculateVaultedMeasuredCeilingArea(params: {
  ridgeLengthIn: NumericLike
  fallbackLengthIn?: NumericLike
  slopeLengthIn: NumericLike
  planeCount: NumericLike
}) {
  const ridgeLength = positive(params.ridgeLengthIn) ?? positive(params.fallbackLengthIn)
  const slopeLength = positive(params.slopeLengthIn)
  const planeCountInput = positive(params.planeCount)
  const normalizedPlaneCount = planeCountInput == null ? null : Math.max(1, Math.floor(planeCountInput))
  return ridgeLength != null && slopeLength != null && normalizedPlaneCount != null
    ? round4((ridgeLength * slopeLength * normalizedPlaneCount) / 144)
    : null
}

export function calculateCofferedCeilingExtraArea(params: {
  sectionLengthIn: NumericLike
  sectionWidthIn: NumericLike
  sectionCount: NumericLike
  faceHeightIn: NumericLike
  bottomWidthIn: NumericLike
}) {
  const sectionLength = nonNegative(params.sectionLengthIn) ?? 0
  const sectionWidth = nonNegative(params.sectionWidthIn) ?? 0
  const sectionCount = Math.max(0, Math.floor(nonNegative(params.sectionCount) ?? 0))
  const faceHeight = nonNegative(params.faceHeightIn) ?? 0
  const bottomWidth = nonNegative(params.bottomWidthIn) ?? 0
  const sectionPerimeter = 2 * (sectionLength + sectionWidth)
  return round4(
    sectionCount * ((sectionPerimeter * faceHeight) / 144 + (sectionPerimeter * bottomWidth) / 144)
  )
}

export function calculateCeilingHelperExtraArea(params: {
  geometryMode: CeilingGeometryMode | null | undefined
  baseArea: NumericLike
  directArea: NumericLike
  measuredVaultedArea: number | null
  vaultedAreaFactor: NumericLike
  cofferSectionLengthIn: NumericLike
  cofferSectionWidthIn: NumericLike
  cofferSectionCount: NumericLike
  cofferFaceHeightIn: NumericLike
  cofferBottomWidthIn: NumericLike
  missingVaultedFactorResult?: number | null
  onUnknownMode?: () => void
}) {
  const base = nonNegative(params.baseArea) ?? 0
  if (base <= 0) return 0

  if (params.geometryMode === 'VAULTED') {
    if (positive(params.directArea) != null) return 0
    if (params.measuredVaultedArea != null) return 0
    const factor = positive(params.vaultedAreaFactor)
    if (factor == null) return params.missingVaultedFactorResult ?? 0
    return round4(Math.max(base * factor - base, 0))
  }

  if (params.geometryMode === 'COFFERED') {
    return calculateCofferedCeilingExtraArea({
      sectionLengthIn: params.cofferSectionLengthIn,
      sectionWidthIn: params.cofferSectionWidthIn,
      sectionCount: params.cofferSectionCount,
      faceHeightIn: params.cofferFaceHeightIn,
      bottomWidthIn: params.cofferBottomWidthIn,
    })
  }

  if (
    params.geometryMode === 'FLAT' ||
    params.geometryMode === 'TRAY' ||
    params.geometryMode === 'MANUAL' ||
    params.geometryMode == null
  ) {
    return 0
  }

  // TypeScript ensures this is unreachable with well-typed callers; guards against
  // runtime data cast through `as` from untyped DB sources.
  const _exhaustive: never = params.geometryMode
  void _exhaustive
  params.onUnknownMode?.()
  return 0
}

export function calculateRoomPerimeterMeasurement(params: {
  roomMode: 'RECT' | 'SEG' | null | undefined
  lengthIn: NumericLike
  widthIn: NumericLike
}) {
  if (params.roomMode !== 'RECT') return null
  const length = positive(params.lengthIn)
  const width = positive(params.widthIn)
  return length != null && width != null ? round4((2 * (length + width)) / 12) : null
}

export function calculateDoorBillableUnits(params: {
  include: YN
  quantity: NumericLike
  sides: NumericLike
  missingQuantityResult?: number | null
}) {
  if (params.include !== 'Y') return 0
  const quantity = nonNegative(params.quantity)
  if (quantity == null) {
    return Object.prototype.hasOwnProperty.call(params, 'missingQuantityResult')
      ? params.missingQuantityResult!
      : 0
  }
  const sides = nonNegative(params.sides)
  const billableSides = sides === 1 || sides === 2 ? sides : 0
  return round4(quantity * billableSides)
}

export function calculateDoorCount(params: {
  include: YN
  quantity: NumericLike
  missingQuantityResult?: number | null
}) {
  if (params.include !== 'Y') return 0
  const quantity = nonNegative(params.quantity)
  if (quantity == null) {
    return Object.prototype.hasOwnProperty.call(params, 'missingQuantityResult')
      ? params.missingQuantityResult!
      : 0
  }
  return round4(quantity)
}

export function calculateDrywallEffectiveQuantity(quantity: NumericLike) {
  return Math.ceil(Math.max(nonNegative(quantity) ?? 0, 0))
}
