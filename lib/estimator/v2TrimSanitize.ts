export type V2TrimRoomMode = 'RECT' | 'SEG'
export type V2TrimMeasurementMode = 'MANUAL' | 'ROOM_HELPER'

export type V2TrimSanitizeRoom = {
  roomId: string
  mode: V2TrimRoomMode
  position: number
}

export type V2TrimSanitizeScope = {
  id: string
  roomId: string
  position: number
  measurementMode: V2TrimMeasurementMode
  helperSource: 'ROOM_PERIMETER' | '' | null
  helperValue: string
  paintProductId?: string
  primerProductId?: string
  overrideMeasurement?: string
  overrideHours?: string
  overrideGallons?: string
  overrideSupplyCost?: string
  overrideTotal?: string
  overrideDescription?: string
}

function sortByPosition<T extends { position: number }>(rows: T[]) {
  return [...rows].sort((a, b) => a.position - b.position)
}

export function sanitizeV2TrimDrafts<TScope extends V2TrimSanitizeScope>(params: {
  rooms: V2TrimSanitizeRoom[]
  trimScopes: TScope[]
}) {
  const roomModeById = new Map(
    params.rooms.map((room) => [room.roomId, room.mode] as const)
  )
  const scopeMap = new Map<string, TScope[]>()
  for (const scope of params.trimScopes) {
    const list = scopeMap.get(scope.roomId)
    if (list) {
      list.push(scope)
    } else {
      scopeMap.set(scope.roomId, [scope])
    }
  }

  let changed = false
  const nextScopes: TScope[] = []

  for (const room of sortByPosition(params.rooms)) {
    const roomScopes = sortByPosition(scopeMap.get(room.roomId) ?? [])
    roomScopes.forEach((scope, index) => {
      let nextScope = scope
      if (scope.position !== index) {
        nextScope = { ...nextScope, position: index }
        changed = true
      }

      const roomMode = roomModeById.get(scope.roomId) ?? 'RECT'
      if (roomMode !== 'RECT' && nextScope.measurementMode === 'ROOM_HELPER') {
        nextScope = {
          ...nextScope,
          measurementMode: 'MANUAL',
          helperSource: null,
          helperValue: '',
        }
        changed = true
      } else if (
        roomMode === 'RECT' &&
        nextScope.measurementMode === 'ROOM_HELPER' &&
        nextScope.helperSource !== 'ROOM_PERIMETER'
      ) {
        nextScope = {
          ...nextScope,
          helperSource: 'ROOM_PERIMETER',
        }
        changed = true
      }

      if (
        nextScope.paintProductId ||
        nextScope.primerProductId ||
        nextScope.overrideMeasurement ||
        nextScope.overrideHours ||
        nextScope.overrideSupplyCost ||
        nextScope.overrideTotal ||
        nextScope.overrideDescription
      ) {
        nextScope = {
          ...nextScope,
          paintProductId: '',
          primerProductId: '',
          overrideMeasurement: '',
          overrideHours: '',
          overrideSupplyCost: '',
          overrideTotal: '',
          overrideDescription: '',
        }
        changed = true
      }

      nextScopes.push(nextScope)
    })
  }

  return {
    trimScopes: nextScopes,
    changed,
  }
}
