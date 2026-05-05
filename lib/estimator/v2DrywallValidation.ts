import { DRYWALL_REPAIR_TYPES, type DrywallRepairType } from '../../types/estimator/drywall.ts'
import { validateV2NumericOverrideFields } from './v2OverrideValidation.ts'

export type V2DrywallValidationRoom = {
  roomId: string
  roomName: string
  position: number
}

export type V2DrywallValidationRepair = {
  id: string
  roomId: string
  position: number
  surface: 'wall' | 'ceiling'
  repairType: string
  quantity: string
  overrideTotal?: string
}

const WALL_REPAIR_TYPES = new Set<DrywallRepairType>([
  'corner_tape_replacement',
  'flat_wall_crack',
  'stress_crack_at_seam',
  'patch_opening_repair',
])

const CEILING_REPAIR_TYPES = new Set<DrywallRepairType>([
  'ceiling_crack',
  'patch_opening_repair',
])

function asNullableNumber(value: unknown) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function sortByPosition<T extends { position: number }>(rows: T[]) {
  return [...rows].sort((a, b) => a.position - b.position)
}

function normalizeRepairType(value: string): DrywallRepairType | null {
  const raw = value.trim().toLowerCase()
  return (DRYWALL_REPAIR_TYPES as readonly string[]).includes(raw)
    ? (raw as DrywallRepairType)
    : null
}

function isRepairValidForSurface(repairType: DrywallRepairType, surface: 'wall' | 'ceiling') {
  return surface === 'ceiling'
    ? CEILING_REPAIR_TYPES.has(repairType)
    : WALL_REPAIR_TYPES.has(repairType)
}

export function validateV2DrywallBeforeSave(params: {
  rooms: V2DrywallValidationRoom[]
  drywallRepairs: V2DrywallValidationRepair[]
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

  const repairIds = new Set<string>()
  for (const repair of params.drywallRepairs) {
    if (!repair.id.trim()) {
      issues.push(`${repair.roomId}: drywall repair id is required`)
      continue
    }
    if (repairIds.has(repair.id)) {
      issues.push(`${repair.roomId}: duplicate drywall repair id ${repair.id}`)
    }
    repairIds.add(repair.id)
    if (!roomIds.has(repair.roomId)) {
      issues.push(`${repair.roomId}: drywall repair ${repair.id} references missing room`)
      continue
    }
    validateV2NumericOverrideFields({
      issues,
      scopeLabel: `${repair.roomId}: drywall repair ${repair.id}`,
      fields: [
        { label: 'total', value: repair.overrideTotal },
      ],
    })

    const repairType = normalizeRepairType(repair.repairType)
    if (!params.allowIncomplete && !repairType) {
      issues.push(`${repair.roomId}: drywall repair type is required`)
    }
    if (repairType && !isRepairValidForSurface(repairType, repair.surface)) {
      issues.push(`${repair.roomId}: drywall repair type is not valid for ${repair.surface}`)
    }

    const quantity = asNullableNumber(repair.quantity)
    if (!params.allowIncomplete && quantity == null) {
      issues.push(`${repair.roomId}: drywall quantity is required`)
    }
    if (quantity != null && quantity < 0) {
      issues.push(`${repair.roomId}: drywall quantity must be nonnegative`)
    }
  }

  return issues
}
