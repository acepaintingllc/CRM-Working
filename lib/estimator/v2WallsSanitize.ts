export type V2WallScopeMode = 'RECT' | 'SEG'

export type V2SanitizeRoom = {
  roomId: string
  lengthIn: string
  widthIn: string
  heightIn: string
  position: number
}

export type V2SanitizeScope = {
  id: string
  roomId: string
  position: number
  mode: V2WallScopeMode
  perimeterIn: string
  heightIn: string
}

export type V2SanitizeSegment = {
  id: string
  wallScopeId: string
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

export function sanitizeV2WallsDrafts<TScope extends V2SanitizeScope, TSegment extends V2SanitizeSegment>(params: {
  rooms: V2SanitizeRoom[]
  scopes: TScope[]
  segments: TSegment[]
}) {
  const orderedRooms = sortByPosition(params.rooms)
  const scopeMap = new Map<string, TScope[]>()
  for (const scope of params.scopes) {
    const list = scopeMap.get(scope.roomId)
    if (list) {
      list.push(scope)
    } else {
      scopeMap.set(scope.roomId, [scope])
    }
  }

  let changed = false
  const nextScopes: TScope[] = []
  const scopeModeById = new Map<string, V2WallScopeMode>()

  for (const room of orderedRooms) {
    const roomScopes = sortByPosition(scopeMap.get(room.roomId) ?? [])
    if (roomScopes.length === 0) continue

    const firstScope = roomScopes[0]
    if (firstScope.mode === 'RECT') {
      const nextRectScope: TScope = {
        ...firstScope,
        position: 0,
      }

      if (roomScopes.length > 1 || firstScope.position !== 0) {
        changed = true
      }

      const length = asNullableNumber(room.lengthIn)
      const width = asNullableNumber(room.widthIn)
      const height = asNullableNumber(room.heightIn)

      if (asNullableNumber(nextRectScope.perimeterIn) == null && length != null && width != null) {
        nextRectScope.perimeterIn = String(2 * (length + width))
        changed = true
      }

      if (asNullableNumber(nextRectScope.heightIn) == null && height != null) {
        nextRectScope.heightIn = String(height)
        changed = true
      }

      nextScopes.push(nextRectScope)
      scopeModeById.set(nextRectScope.id, nextRectScope.mode)
      continue
    }

    roomScopes.forEach((scope, index) => {
      if (scope.position !== index) changed = true
      const nextScope = scope.position === index ? scope : { ...scope, position: index }
      nextScopes.push(nextScope)
      scopeModeById.set(nextScope.id, nextScope.mode)
    })
  }

  const segByScope = new Map<string, TSegment[]>()
  for (const segment of params.segments) {
    const scopeMode = scopeModeById.get(segment.wallScopeId)
    if (scopeMode !== 'SEG') {
      changed = true
      continue
    }
    const list = segByScope.get(segment.wallScopeId)
    if (list) {
      list.push(segment)
    } else {
      segByScope.set(segment.wallScopeId, [segment])
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
    scopes: sortByPosition(nextScopes),
    segments: nextSegments,
    changed,
  }
}
