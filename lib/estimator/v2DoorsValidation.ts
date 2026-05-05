import { validateV2NumericOverrideFields } from './v2OverrideValidation.ts'

export type V2DoorValidationRoom = {
  roomId: string
  roomName: string
  position: number
}

export type V2DoorValidationScope = {
  id: string
  roomId: string
  position: number
  include: 'Y' | 'N'
  doorTypeId: string
  quantity: string
  sides: string
  overridePaintHours?: string
  overridePrimerHours?: string
  overrideMaterialCost?: string
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

export function validateV2DoorsBeforeSave(params: {
  rooms: V2DoorValidationRoom[]
  doorScopes: V2DoorValidationScope[]
  allowIncomplete?: boolean
}) {
  const issues: string[] = []
  const roomIds = new Set<string>()

  for (const room of sortByPosition(params.rooms)) {
    if (!room.roomName.trim()) {
      issues.push(`${room.roomId}: room name is required`)
    }
    if (roomIds.has(room.roomId)) {
      issues.push(`${room.roomId}: duplicate room id`)
    }
    roomIds.add(room.roomId)
  }

  const scopeIds = new Set<string>()
  for (const scope of params.doorScopes) {
    if (!scope.id.trim()) {
      issues.push(`${scope.roomId}: door scope id is required`)
      continue
    }
    if (scopeIds.has(scope.id)) {
      issues.push(`${scope.roomId}: duplicate door scope id ${scope.id}`)
    }
    scopeIds.add(scope.id)
    if (!roomIds.has(scope.roomId)) {
      issues.push(`${scope.roomId}: door scope ${scope.id} references missing room`)
      continue
    }
    validateV2NumericOverrideFields({
      issues,
      scopeLabel: `${scope.roomId}: door scope ${scope.id}`,
      fields: [
        { label: 'paint hours', value: scope.overridePaintHours },
        { label: 'primer hours', value: scope.overridePrimerHours },
        { label: 'material cost', value: scope.overrideMaterialCost },
        { label: 'supply cost', value: scope.overrideSupplyCost },
        { label: 'total', value: scope.overrideTotal },
      ],
    })

    if (scope.include !== 'Y') continue

    if (!params.allowIncomplete && !scope.doorTypeId.trim()) {
      issues.push(`${scope.roomId}: door type is required`)
    }

    const quantity = asNullableNumber(scope.quantity)
    if (!params.allowIncomplete && quantity == null) {
      issues.push(`${scope.roomId}: door quantity is required`)
    }
    if (quantity != null && quantity < 0) {
      issues.push(`${scope.roomId}: door quantity must be nonnegative`)
    }

    const sides = asNullableNumber(scope.sides)
    if (!params.allowIncomplete && sides == null) {
      issues.push(`${scope.roomId}: door sides is required`)
    }
    if (sides != null && sides !== 1 && sides !== 2) {
      issues.push(`${scope.roomId}: door sides must be 1 or 2`)
    }
  }

  return issues
}
