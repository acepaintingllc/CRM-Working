import { validateV2NumericOverrideFields } from './v2OverrideValidation.ts'

export type V2CeilingScopeMode = 'RECT' | 'SEG'
export type V2CeilingSegmentShape = 'RECTANGLE' | 'TRIANGLE' | 'MANUAL'

export type V2CeilingScopeDraftLike = {
  id: string
  roomId: string
  position: number
  mode: V2CeilingScopeMode
  include: 'Y' | 'N'
  lengthIn: string
  widthIn: string
  overrideAreaSqFt?: string
  overridePaintHours?: string
  overridePrimerHours?: string
  overridePaintGallons?: string
  overridePrimerGallons?: string
  overrideSupplyCost?: string
  overrideTotal?: string
  areaSf: string  // direct area input (alternative to L×W)
}

export type V2CeilingSegmentDraftLike = {
  id: string
  ceilingScopeId: string
  roomId: string
  include: 'Y' | 'N'
  shapeType: V2CeilingSegmentShape
  quantity: string
  widthIn: string
  heightIn: string
  baseIn: string
  manualAreaSqFt: string
  overrideAreaSqFt?: string
}

function asNullableNumber(value: unknown) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function sortByPosition<T extends { position: number }>(rows: T[]) {
  return [...rows].sort((a, b) => a.position - b.position)
}

export type V2CeilingsRoomLike = {
  roomId: string
  roomName: string
  position: number
}

export function validateV2CeilingsBeforeSave(params: {
  rooms: V2CeilingsRoomLike[]
  ceilingScopes: V2CeilingScopeDraftLike[]
  ceilingSegments: V2CeilingSegmentDraftLike[]
  allowIncomplete?: boolean
}) {
  const issues: string[] = []
  const { rooms, ceilingScopes, ceilingSegments } = params

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
  for (const scope of ceilingScopes) {
    if (!scope.id.trim()) {
      issues.push(`${scope.roomId}: ceiling scope id is required`)
      continue
    }
    if (scopeIds.has(scope.id)) {
      issues.push(`${scope.roomId}: duplicate ceiling scope id ${scope.id}`)
    }
    scopeIds.add(scope.id)
    validateV2NumericOverrideFields({
      issues,
      scopeLabel: `${scope.roomId}: ceiling scope ${scope.id}`,
      fields: [
        { label: 'area', value: scope.overrideAreaSqFt },
        { label: 'paint hours', value: scope.overridePaintHours },
        { label: 'primer hours', value: scope.overridePrimerHours },
        { label: 'paint gallons', value: scope.overridePaintGallons },
        { label: 'primer gallons', value: scope.overridePrimerGallons },
        { label: 'supply cost', value: scope.overrideSupplyCost },
        { label: 'total', value: scope.overrideTotal },
      ],
    })
  }

  const segmentIds = new Set<string>()
  for (const segment of ceilingSegments) {
    if (!segment.id.trim()) {
      issues.push(`${segment.roomId}: ceiling segment id is required`)
      continue
    }
    if (segmentIds.has(segment.id)) {
      issues.push(`${segment.roomId}: duplicate ceiling segment id ${segment.id}`)
    }
    segmentIds.add(segment.id)
    validateV2NumericOverrideFields({
      issues,
      scopeLabel: `${segment.roomId}: ceiling segment ${segment.id}`,
      fields: [
        { label: 'area', value: segment.overrideAreaSqFt },
      ],
    })
    if (!scopeIds.has(segment.ceilingScopeId)) {
      issues.push(
        `${segment.roomId}: ceiling segment ${segment.id} references missing scope ${segment.ceilingScopeId}`
      )
    }
  }

  for (const room of sortByPosition(rooms)) {
    const roomScopes = sortByPosition(ceilingScopes.filter((scope) => scope.roomId === room.roomId))
    if (roomScopes.length === 0) continue

    const roomMode = roomScopes[0].mode
    if (roomScopes.some((scope) => scope.mode !== roomMode)) {
      issues.push(`${room.roomId}: all ceiling scopes must use the same mode`)
    }
    if (roomMode === 'RECT' && roomScopes.length > 1) {
      issues.push(`${room.roomId}: RECT mode allows only one ceiling scope`)
    }

    for (const scope of roomScopes) {
      // RECT ceiling dimensions come from room L×W at save time; no scope-level L/W required

      if (scope.mode !== 'SEG') continue
      const scopeSegments = ceilingSegments.filter((segment) => segment.ceilingScopeId === scope.id)
      if (!params.allowIncomplete && scope.include === 'Y' && !scopeSegments.some((segment) => segment.include === 'Y')) {
        issues.push(`${room.roomId}: SEG ceiling scope requires at least one included segment`)
      }

      if (scope.include !== 'Y') continue
      for (const segment of scopeSegments) {
        if (segment.include !== 'Y') continue
        const quantity = asNullableNumber(segment.quantity)
        if (!params.allowIncomplete && (quantity == null || quantity <= 0)) {
          issues.push(`${room.roomId}: ceiling segment quantity must be greater than 0`)
        }
        if (params.allowIncomplete) continue
        if (segment.shapeType === 'RECTANGLE') {
          if (asNullableNumber(segment.widthIn) == null || asNullableNumber(segment.heightIn) == null) {
            issues.push(`${room.roomId}: rectangle ceiling segments require width and height`)
          }
        }
        if (segment.shapeType === 'TRIANGLE') {
          if (asNullableNumber(segment.baseIn) == null || asNullableNumber(segment.heightIn) == null) {
            issues.push(`${room.roomId}: triangle ceiling segments require base and height`)
          }
        }
        if (segment.shapeType === 'MANUAL' && asNullableNumber(segment.manualAreaSqFt) == null) {
          issues.push(`${room.roomId}: manual ceiling segments require area`)
        }
      }
    }
  }

  return issues
}
