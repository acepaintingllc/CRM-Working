import {
  isV2TrimRoomHelperEligible,
  V2_TRIM_ROOM_HELPER_SOURCE,
} from './v2TrimActivation.ts'
import { validateV2NumericOverrideFields } from './v2OverrideValidation.ts'

export type V2TrimRoomMode = 'RECT' | 'SEG'
export type V2TrimMeasurementMode = 'MANUAL' | 'ROOM_HELPER'

export type V2TrimValidationRoom = {
  roomId: string
  roomName: string
  mode: V2TrimRoomMode
  position: number
}

export type V2TrimValidationScope = {
  id: string
  roomId: string
  position: number
  include: 'Y' | 'N'
  trimTypeId: string
  measurementMode: V2TrimMeasurementMode
  helperSource: string | null
  measurementValue: string
  overrideMeasurement?: string
  overrideHours?: string
  overrideGallons?: string
  overrideSupplyCost?: string
  overrideTotal?: string
}

function asNullableNumber(value: unknown) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function sortByPosition<T extends { position: number }>(rows: T[]) {
  return [...rows].sort((a, b) => a.position - b.position)
}

export function validateV2TrimBeforeSave(params: {
  rooms: V2TrimValidationRoom[]
  trimScopes: V2TrimValidationScope[]
  allowIncomplete?: boolean
}) {
  const issues: string[] = []
  const roomIds = new Set<string>()
  const roomModeById = new Map<string, V2TrimRoomMode>()

  for (const room of sortByPosition(params.rooms)) {
    if (!room.roomName.trim()) {
      issues.push(`${room.roomId}: room name is required`)
    }
    if (roomIds.has(room.roomId)) {
      issues.push(`${room.roomId}: duplicate room id`)
    }
    roomIds.add(room.roomId)
    roomModeById.set(room.roomId, room.mode)
  }

  const scopeIds = new Set<string>()
  for (const scope of params.trimScopes) {
    if (!scope.id.trim()) {
      issues.push(`${scope.roomId}: trim scope id is required`)
      continue
    }
    if (scopeIds.has(scope.id)) {
      issues.push(`${scope.roomId}: duplicate trim scope id ${scope.id}`)
    }
    scopeIds.add(scope.id)
    if (!roomIds.has(scope.roomId)) {
      issues.push(`${scope.roomId}: trim scope ${scope.id} references missing room`)
      continue
    }
    validateV2NumericOverrideFields({
      issues,
      scopeLabel: `${scope.roomId}: trim scope ${scope.id}`,
      fields: [
        { label: 'measurement', value: scope.overrideMeasurement },
        { label: 'hours', value: scope.overrideHours },
        { label: 'gallons', value: scope.overrideGallons },
        { label: 'supply cost', value: scope.overrideSupplyCost },
        { label: 'total', value: scope.overrideTotal },
      ],
    })

    if (scope.include !== 'Y') continue

    if (!params.allowIncomplete && !scope.trimTypeId.trim()) {
      issues.push(`${scope.roomId}: trim type is required`)
    }

    if (scope.measurementMode === 'ROOM_HELPER') {
      const roomMode = roomModeById.get(scope.roomId) ?? 'RECT'
      if (!isV2TrimRoomHelperEligible({ roomMode })) {
        issues.push(`${scope.roomId}: ROOM_HELPER is only allowed in RECT rooms`)
      }
      if ((scope.helperSource ?? '').toUpperCase() !== V2_TRIM_ROOM_HELPER_SOURCE) {
        issues.push(`${scope.roomId}: helper source must be ROOM_PERIMETER for ROOM_HELPER`)
      }
      continue
    }

    if (params.allowIncomplete) continue
    const measurement = asNullableNumber(scope.measurementValue)
    if (measurement == null || measurement <= 0) {
      issues.push(`${scope.roomId}: trim measurement must be greater than 0`)
    }
  }

  return issues
}
