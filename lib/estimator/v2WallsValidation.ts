export type V2WallScopeMode = 'RECT' | 'SEG'
export type V2WallSegmentShape = 'RECTANGLE' | 'TRIANGLE' | 'MANUAL'

export type V2RoomDraftLike = {
  roomId: string
  roomName: string
  position: number
}

export type V2WallScopeDraftLike = {
  id: string
  roomId: string
  position: number
  mode: V2WallScopeMode
  include: 'Y' | 'N'
  perimeterIn: string
  heightIn: string
}

export type V2WallSegmentDraftLike = {
  id: string
  wallScopeId: string
  roomId: string
  include: 'Y' | 'N'
  shapeType: V2WallSegmentShape
  quantity: string
  widthIn: string
  heightIn: string
  baseIn: string
  manualAreaSqFt: string
}

function asNullableNumber(value: unknown) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function sortByPosition<T extends { position: number }>(rows: T[]) {
  return [...rows].sort((a, b) => a.position - b.position)
}

export function validateV2WallsBeforeSave(params: {
  rooms: V2RoomDraftLike[]
  scopes: V2WallScopeDraftLike[]
  segments: V2WallSegmentDraftLike[]
}) {
  const issues: string[] = []
  const { rooms, scopes, segments } = params

  const roomIds = new Set<string>()
  for (const room of sortByPosition(rooms)) {
    if (!room.roomName.trim()) {
      issues.push(`${room.roomId}: room name is required`)
    }
    if (roomIds.has(room.roomId)) {
      issues.push(`${room.roomId}: duplicate room id`)
    }
    roomIds.add(room.roomId)
  }

  const scopeIds = new Set<string>()
  for (const scope of scopes) {
    if (!scope.id.trim()) {
      issues.push(`${scope.roomId}: wall scope id is required`)
      continue
    }
    if (scopeIds.has(scope.id)) {
      issues.push(`${scope.roomId}: duplicate wall scope id ${scope.id}`)
    }
    scopeIds.add(scope.id)
  }

  const segmentIds = new Set<string>()
  for (const segment of segments) {
    if (!segment.id.trim()) {
      issues.push(`${segment.roomId}: segment id is required`)
      continue
    }
    if (segmentIds.has(segment.id)) {
      issues.push(`${segment.roomId}: duplicate segment id ${segment.id}`)
    }
    segmentIds.add(segment.id)
    if (!scopeIds.has(segment.wallScopeId)) {
      issues.push(`${segment.roomId}: segment ${segment.id} references missing scope ${segment.wallScopeId}`)
    }
  }

  for (const room of sortByPosition(rooms)) {
    const roomScopes = sortByPosition(scopes.filter((scope) => scope.roomId === room.roomId))
    if (roomScopes.length === 0) continue

    const roomMode = roomScopes[0].mode
    if (roomScopes.some((scope) => scope.mode !== roomMode)) {
      issues.push(`${room.roomId}: all wall scopes must use the same mode`)
    }
    if (roomMode === 'RECT' && roomScopes.length > 1) {
      issues.push(`${room.roomId}: RECT mode allows only one wall scope`)
    }

    for (const scope of roomScopes) {
      if (scope.mode === 'RECT' && scope.include === 'Y') {
        if (asNullableNumber(scope.perimeterIn) == null) {
          issues.push(`${room.roomId}: perimeter is required for RECT wall mode`)
        }
        if (asNullableNumber(scope.heightIn) == null) {
          issues.push(`${room.roomId}: height is required for RECT wall mode`)
        }
      }

      if (scope.mode !== 'SEG') continue
      const scopeSegments = segments.filter((segment) => segment.wallScopeId === scope.id)
      if (scope.include === 'Y' && !scopeSegments.some((segment) => segment.include === 'Y')) {
        issues.push(`${room.roomId}: SEG scope requires at least one included segment`)
      }

      for (const segment of scopeSegments) {
        const quantity = asNullableNumber(segment.quantity)
        if (quantity == null || quantity <= 0) {
          issues.push(`${room.roomId}: segment quantity must be greater than 0`)
        }
        if (segment.shapeType === 'RECTANGLE') {
          if (asNullableNumber(segment.widthIn) == null || asNullableNumber(segment.heightIn) == null) {
            issues.push(`${room.roomId}: rectangle segments require width and height`)
          }
        }
        if (segment.shapeType === 'TRIANGLE') {
          if (asNullableNumber(segment.baseIn) == null || asNullableNumber(segment.heightIn) == null) {
            issues.push(`${room.roomId}: triangle segments require base and height`)
          }
        }
        if (segment.shapeType === 'MANUAL' && asNullableNumber(segment.manualAreaSqFt) == null) {
          issues.push(`${room.roomId}: manual segments require area`)
        }
      }
    }
  }

  return issues
}
