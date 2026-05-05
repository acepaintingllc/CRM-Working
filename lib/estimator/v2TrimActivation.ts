export const V2_TRIM_ROOM_HELPER_SOURCE = 'ROOM_PERIMETER' as const

export type V2TrimRoomMode = 'RECT' | 'SEG'
export type V2TrimMeasurementMode = 'MANUAL' | 'ROOM_HELPER'
export type V2TrimHelperSource = typeof V2_TRIM_ROOM_HELPER_SOURCE

export type V2TrimActivationRoom = {
  roomId: string
  lengthIn?: string | null
  widthIn?: string | null
}

export type V2TrimActivationTrimType = {
  id: string
  label: string
  helper_allowed: boolean
}

export type V2TrimActivationScope = {
  trimTypeId: string
  scopeName: string
  measurementMode: V2TrimMeasurementMode
  helperSource: V2TrimHelperSource | ''
  helperValue: string
  measurementValue: string
}

export type V2TrimActivationDefaults = Pick<
  V2TrimActivationScope,
  | 'trimTypeId'
  | 'scopeName'
  | 'measurementMode'
  | 'helperSource'
  | 'helperValue'
  | 'measurementValue'
>

function numberOrNull(value: unknown) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function round4(value: number) {
  return Math.round(value * 10000) / 10000
}

export function resolveV2TrimRoomPerimeterLf(room?: V2TrimActivationRoom | null) {
  const roomLength = numberOrNull(room?.lengthIn ?? '')
  const roomWidth = numberOrNull(room?.widthIn ?? '')
  return roomLength != null && roomWidth != null ? String(round4((2 * (roomLength + roomWidth)) / 12)) : ''
}

export function isV2TrimRoomHelperEligible(params: {
  roomMode: V2TrimRoomMode
  trimTypeHelperAllowed?: boolean
}) {
  return params.roomMode === 'RECT' && params.trimTypeHelperAllowed !== false
}

export function normalizeV2TrimHelperMode<TSource extends V2TrimHelperSource | '' | null>(params: {
  measurementMode: V2TrimMeasurementMode
  helperSource: TSource
  helperValue: string
  roomMode: V2TrimRoomMode
  trimTypeHelperAllowed?: boolean
  emptyHelperSource: Exclude<TSource, V2TrimHelperSource>
}): {
  measurementMode: V2TrimMeasurementMode
  helperSource: TSource
  helperValue: string
} {
  if (params.measurementMode !== 'ROOM_HELPER') {
    return {
      measurementMode: params.measurementMode,
      helperSource: params.helperSource,
      helperValue: params.helperValue,
    }
  }

  if (
    isV2TrimRoomHelperEligible({
      roomMode: params.roomMode,
      trimTypeHelperAllowed: params.trimTypeHelperAllowed,
    })
  ) {
    return {
      measurementMode: 'ROOM_HELPER',
      helperSource: V2_TRIM_ROOM_HELPER_SOURCE as TSource,
      helperValue: params.helperValue,
    }
  }

  return {
    measurementMode: 'MANUAL',
    helperSource: params.emptyHelperSource,
    helperValue: '',
  }
}

export function buildV2TrimActivationDefaults<TScope extends V2TrimActivationScope>(params: {
  scope: TScope
  room?: V2TrimActivationRoom | null
  roomMode: V2TrimRoomMode
  trimType?: V2TrimActivationTrimType | null
  fallbackTrimType?: V2TrimActivationTrimType | null
}): V2TrimActivationDefaults {
  const trimType = params.trimType ?? params.fallbackTrimType ?? null
  const existingMeasurement = numberOrNull(params.scope.measurementValue)
  const existingHelper = numberOrNull(params.scope.helperValue)
  const roomPerimeter = resolveV2TrimRoomPerimeterLf(params.room)
  const manualFallbackMeasurement =
    existingMeasurement != null && existingMeasurement > 0
      ? params.scope.measurementValue
      : existingHelper != null && existingHelper > 0
        ? params.scope.helperValue
        : ''
  const helperFallbackMeasurement = roomPerimeter || manualFallbackMeasurement
  const helperAllowed = isV2TrimRoomHelperEligible({
    roomMode: params.roomMode,
    trimTypeHelperAllowed: !!trimType?.helper_allowed,
  })
  const shouldUseHelper =
    helperAllowed &&
    (params.scope.measurementMode === 'ROOM_HELPER' ||
      !(existingMeasurement != null && existingMeasurement > 0))

  return {
    trimTypeId: params.scope.trimTypeId || trimType?.id || '',
    scopeName: params.scope.scopeName || trimType?.label || '',
    measurementMode: shouldUseHelper ? 'ROOM_HELPER' : params.scope.measurementMode,
    helperSource: shouldUseHelper ? V2_TRIM_ROOM_HELPER_SOURCE : params.scope.helperSource,
    helperValue: shouldUseHelper ? helperFallbackMeasurement : params.scope.helperValue,
    measurementValue: shouldUseHelper ? params.scope.measurementValue : manualFallbackMeasurement,
  }
}
