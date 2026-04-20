export type V2CeilingScopeMode = 'RECT' | 'SEG'

export type V2CeilingSanitizeRoom = {
  roomId: string
  lengthIn: string
  widthIn: string
  position: number
}

export type V2CeilingSanitizeScope = {
  id: string
  roomId: string
  position: number
  mode: V2CeilingScopeMode
  lengthIn: string
  widthIn: string
}

export type V2CeilingSanitizeSegment = {
  id: string
  ceilingScopeId: string
  position: number
}

function asNullableNumber(value: unknown) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function sortByPosition<T extends { position: number }>(rows: T[]) {
  return [...rows].sort((a, b) => a.position - b.position)
}

export function sanitizeV2CeilingsDrafts<
  TScope extends V2CeilingSanitizeScope,
  TSegment extends V2CeilingSanitizeSegment,
>(params: {
  rooms: V2CeilingSanitizeRoom[]
  ceilingScopes: TScope[]
  ceilingSegments: TSegment[]
}) {
  const orderedRooms = sortByPosition(params.rooms)
  const scopeMap = new Map<string, TScope[]>()
  for (const scope of params.ceilingScopes) {
    const list = scopeMap.get(scope.roomId)
    if (list) {
      list.push(scope)
    } else {
      scopeMap.set(scope.roomId, [scope])
    }
  }

  let changed = false
  const nextScopes: TScope[] = []
  const scopeModeById = new Map<string, V2CeilingScopeMode>()

  for (const room of orderedRooms) {
    const roomScopes = sortByPosition(scopeMap.get(room.roomId) ?? [])
    if (roomScopes.length === 0) continue

    const firstScope = roomScopes[0]
    if (firstScope.mode === 'RECT') {
      const nextRectScope: TScope = { ...firstScope, position: 0 }

      if (roomScopes.length > 1 || firstScope.position !== 0) {
        changed = true
      }

      // Auto-fill length/width from room dims if blank
      const length = asNullableNumber(room.lengthIn)
      const width = asNullableNumber(room.widthIn)

      if (asNullableNumber(nextRectScope.lengthIn) == null && length != null) {
        nextRectScope.lengthIn = String(length)
        changed = true
      }
      if (asNullableNumber(nextRectScope.widthIn) == null && width != null) {
        nextRectScope.widthIn = String(width)
        changed = true
      }

      nextScopes.push(nextRectScope)
      scopeModeById.set(nextRectScope.id, nextRectScope.mode)
      continue
    }

    // SEG mode: keep all scopes, fix positions
    roomScopes.forEach((scope, index) => {
      if (scope.position !== index) changed = true
      const nextScope = scope.position === index ? scope : { ...scope, position: index }
      nextScopes.push(nextScope)
      scopeModeById.set(nextScope.id, nextScope.mode)
    })
  }

  // Only keep segments belonging to SEG-mode scopes
  const segByScope = new Map<string, TSegment[]>()
  for (const segment of params.ceilingSegments) {
    const scopeMode = scopeModeById.get(segment.ceilingScopeId)
    if (scopeMode !== 'SEG') {
      changed = true
      continue
    }
    const list = segByScope.get(segment.ceilingScopeId)
    if (list) {
      list.push(segment)
    } else {
      segByScope.set(segment.ceilingScopeId, [segment])
    }
  }

  const nextSegments: TSegment[] = []
  for (const scope of sortByPosition(nextScopes)) {
    const scopeSegments = segByScope.get(scope.id)
    if (!scopeSegments) continue
    sortByPosition(scopeSegments).forEach((segment, index) => {
      if (segment.position !== index) changed = true
      const nextSegment = segment.position === index ? segment : { ...segment, position: index }
      nextSegments.push(nextSegment)
    })
  }

  return {
    ceilingScopes: sortByPosition(nextScopes),
    ceilingSegments: nextSegments,
    changed,
  }
}
