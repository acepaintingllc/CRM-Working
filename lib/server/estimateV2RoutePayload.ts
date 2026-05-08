import type {
  WallCalculationCatalogs,
} from '../estimator/walls.ts'
import {
  asNullableNumber,
  asText,
  isUuid,
  type UnsafeRecord as Unsafe,
} from '../estimator/parsing.ts'
import type {
  EstimateV2CeilingScopeSaveRow,
  EstimateV2CeilingSegmentSaveRow,
  EstimateV2DoorScopeSaveRow,
  EstimateV2DrywallRepairSaveRow,
  EstimateV2RoomRosterCalculationRow,
  EstimateV2TrimScopeSaveRow,
  EstimateV2WallScopeSaveRow,
  EstimateV2WallSegmentSaveRow,
} from '@/types/estimator/v2Boundary'
import {
  normalizeEstimateV2CeilingScopeRow,
  normalizeEstimateV2CeilingSegmentRow,
  normalizeEstimateV2DoorScopeRow,
  normalizeEstimateV2DrywallRepairRow,
  normalizeEstimateV2RoomRow,
  normalizeEstimateV2TrimScopeRow,
  normalizeEstimateV2WallScopeRow,
  normalizeEstimateV2WallSegmentRow,
} from '../../types/estimator/v2Boundary.ts'
import {
  toCeilingCalculationCatalogs as toSharedCeilingCalculationCatalogs,
  toDoorCalculationCatalogs as toSharedDoorCalculationCatalogs,
  toDrywallCalculationCatalogs as toSharedDrywallCalculationCatalogs,
  toTrimCalculationCatalogs as toSharedTrimCalculationCatalogs,
  toWallCalculationCatalogs as toSharedWallCalculationCatalogs,
} from '../estimator/v2CalculationShared.ts'

function nextRoomId(used: Set<string>, startAt: number) {
  let n = Math.max(1, startAt)
  while (used.has(`R${String(n).padStart(3, '0')}`)) {
    n += 1
  }
  return `R${String(n).padStart(3, '0')}`
}

function saveRowId(row: Unsafe): string | undefined {
  return isUuid(row.id) ? asText(row.id) : undefined
}

function toWallScopeMode(value: unknown): 'RECT' | 'SEG' {
  return asText(value).toUpperCase() === 'SEG' ? 'SEG' : 'RECT'
}

function toWallSegmentShape(value: unknown): 'RECTANGLE' | 'TRIANGLE' | 'MANUAL' {
  const raw = asText(value).toUpperCase()
  if (raw === 'TRIANGLE' || raw === 'MANUAL') return raw
  return 'RECTANGLE'
}

export type V2RoomRosterRow = EstimateV2RoomRosterCalculationRow

export type V2WallScopeSaveRow = EstimateV2WallScopeSaveRow
export type V2WallSegmentSaveRow = EstimateV2WallSegmentSaveRow

export function buildV2RoomRosterRows(rows: Unsafe[]) {
  const usedRoomIds = new Set<string>()
  return rows.map((row, idx) => {
    const roomName = asText(row.room_name)
    if (!roomName) {
      throw new Error(`Room ${idx + 1}: room name is required`)
    }
    const requestedRoomId = asText(row.room_id).toUpperCase()
    const roomId = requestedRoomId || nextRoomId(usedRoomIds, idx + 1)
    if (usedRoomIds.has(roomId)) {
      throw new Error(`Room ${idx + 1}: room id ${roomId} is duplicated`)
    }
    usedRoomIds.add(roomId)
    return normalizeEstimateV2RoomRow(
      { ...row, id: saveRowId(row), room_id: roomId, position: idx },
      idx
    ) satisfies V2RoomRosterRow
  })
}

export function buildV2WallScopeRows(rows: Unsafe[], roomIds: Set<string>) {
  const modeByRoom = new Map<string, 'RECT' | 'SEG'>()
  const rectCountByRoom = new Map<string, number>()
  const positionByRoom = new Map<string, number>()

  const scopeRows = rows.map((row, idx) => {
    const roomId = asText(row.room_id).toUpperCase()
    if (!roomId || !roomIds.has(roomId)) {
      throw new Error(`Wall scope ${idx + 1}: room is missing or invalid`)
    }
    const mode = toWallScopeMode(row.mode)
    const knownMode = modeByRoom.get(roomId)
    if (knownMode && knownMode !== mode) {
      throw new Error(`Room ${roomId}: all wall scopes must use the same mode`)
    }
    modeByRoom.set(roomId, mode)
    if (mode === 'RECT') {
      const nextRectCount = (rectCountByRoom.get(roomId) ?? 0) + 1
      rectCountByRoom.set(roomId, nextRectCount)
      if (nextRectCount > 1) {
        throw new Error(`Room ${roomId}: only one active RECT wall scope is allowed`)
      }
    }

    const nextPosition = positionByRoom.get(roomId) ?? 0
    positionByRoom.set(roomId, nextPosition + 1)

    return normalizeEstimateV2WallScopeRow(
      { ...row, id: saveRowId(row), room_id: roomId, position: nextPosition, mode },
      nextPosition
    ) satisfies V2WallScopeSaveRow
  })

  return {
    scopeRows,
    scopeIds: new Set(
      scopeRows
        .map((row) => row.id)
        .filter((value): value is string => !!value)
    ),
    modeByRoom,
  }
}

export function buildV2WallSegmentRows(rows: Unsafe[], scopeRows: V2WallScopeSaveRow[]) {
  const roomIdByScopeId = new Map<string, string>()
  const modeByScopeId = new Map<string, 'RECT' | 'SEG'>()
  for (const scope of scopeRows) {
    if (!scope.id) continue
    roomIdByScopeId.set(scope.id, scope.room_id)
    modeByScopeId.set(scope.id, scope.mode)
  }

  const positionByScope = new Map<string, number>()
  return rows.map((row, idx) => {
    const scopeId = asText(row.wall_scope_id)
    const scopeRoomId = roomIdByScopeId.get(scopeId)
    if (!scopeId || !scopeRoomId) {
      throw new Error(`Wall segment ${idx + 1}: wall scope is missing or invalid`)
    }
    if (modeByScopeId.get(scopeId) !== 'SEG') {
      throw new Error(`Wall segment ${idx + 1}: segments can only belong to SEG scopes`)
    }

    const shapeType = toWallSegmentShape(row.shape_type)
    const quantity = asNullableNumber(row.quantity)
    if (quantity == null || quantity <= 0) {
      throw new Error(`Wall segment ${idx + 1}: quantity must be greater than 0`)
    }

    const nextPosition = positionByScope.get(scopeId) ?? 0
    positionByScope.set(scopeId, nextPosition + 1)

    return normalizeEstimateV2WallSegmentRow(
      {
        ...row,
        id: saveRowId(row),
        wall_scope_id: scopeId,
        room_id: scopeRoomId,
        position: nextPosition,
        shape_type: shapeType,
        quantity,
      },
      nextPosition
    ) satisfies V2WallSegmentSaveRow
  })
}

// ─── Ceiling scope builders ───────────────────────────────────────────────────

function toCeilingScopeMode(value: unknown): 'RECT' | 'SEG' {
  return asText(value).toUpperCase() === 'SEG' ? 'SEG' : 'RECT'
}

function toCeilingSegmentShape(value: unknown): 'RECTANGLE' | 'TRIANGLE' | 'MANUAL' {
  const raw = asText(value).toUpperCase()
  if (raw === 'TRIANGLE' || raw === 'MANUAL') return raw
  return 'RECTANGLE'
}

export type V2CeilingScopeSaveRow = EstimateV2CeilingScopeSaveRow
export type V2CeilingSegmentSaveRow = EstimateV2CeilingSegmentSaveRow
export type V2TrimScopeSaveRow = EstimateV2TrimScopeSaveRow
export type V2DoorScopeSaveRow = EstimateV2DoorScopeSaveRow
export type V2DrywallRepairSaveRow = EstimateV2DrywallRepairSaveRow

export function buildV2CeilingScopeRows(rows: Unsafe[], roomIds: Set<string>) {
  const modeByRoom = new Map<string, 'RECT' | 'SEG'>()
  const rectCountByRoom = new Map<string, number>()
  const positionByRoom = new Map<string, number>()

  const scopeRows = rows.map((row, idx) => {
    const roomId = asText(row.room_id).toUpperCase()
    if (!roomId || !roomIds.has(roomId)) {
      throw new Error(`Ceiling scope ${idx + 1}: room is missing or invalid`)
    }
    const mode = toCeilingScopeMode(row.mode)
    const knownMode = modeByRoom.get(roomId)
    if (knownMode && knownMode !== mode) {
      throw new Error(`Room ${roomId}: all ceiling scopes must use the same mode`)
    }
    modeByRoom.set(roomId, mode)
    if (mode === 'RECT') {
      const nextCount = (rectCountByRoom.get(roomId) ?? 0) + 1
      rectCountByRoom.set(roomId, nextCount)
      if (nextCount > 1) {
        throw new Error(`Room ${roomId}: only one active RECT ceiling scope is allowed`)
      }
    }

    const nextPosition = positionByRoom.get(roomId) ?? 0
    positionByRoom.set(roomId, nextPosition + 1)

    return normalizeEstimateV2CeilingScopeRow(
      { ...row, id: saveRowId(row), room_id: roomId, position: nextPosition, mode },
      nextPosition
    ) satisfies V2CeilingScopeSaveRow
  })

  return {
    scopeRows,
    scopeIds: new Set(
      scopeRows
        .map((row) => row.id)
        .filter((value): value is string => !!value)
    ),
    modeByRoom,
  }
}

export function buildV2CeilingSegmentRows(rows: Unsafe[], scopeRows: V2CeilingScopeSaveRow[]) {
  const roomIdByScopeId = new Map<string, string>()
  const modeByScopeId = new Map<string, 'RECT' | 'SEG'>()
  for (const scope of scopeRows) {
    if (!scope.id) continue
    roomIdByScopeId.set(scope.id, scope.room_id)
    modeByScopeId.set(scope.id, scope.mode)
  }

  const positionByScope = new Map<string, number>()
  return rows.map((row, idx) => {
    const scopeId = asText(row.ceiling_scope_id)
    const scopeRoomId = roomIdByScopeId.get(scopeId)
    if (!scopeId || !scopeRoomId) {
      throw new Error(`Ceiling segment ${idx + 1}: ceiling scope is missing or invalid`)
    }
    if (modeByScopeId.get(scopeId) !== 'SEG') {
      throw new Error(`Ceiling segment ${idx + 1}: segments can only belong to SEG scopes`)
    }

    const shapeType = toCeilingSegmentShape(row.shape_type)
    const quantity = asNullableNumber(row.quantity)
    if (quantity == null || quantity <= 0) {
      throw new Error(`Ceiling segment ${idx + 1}: quantity must be greater than 0`)
    }

    const nextPosition = positionByScope.get(scopeId) ?? 0
    positionByScope.set(scopeId, nextPosition + 1)

    return normalizeEstimateV2CeilingSegmentRow(
      {
        ...row,
        id: saveRowId(row),
        ceiling_scope_id: scopeId,
        room_id: scopeRoomId,
        position: nextPosition,
        shape_type: shapeType,
        quantity,
      },
      nextPosition
    ) satisfies V2CeilingSegmentSaveRow
  })
}

// ─── Trim scope builders ──────────────────────────────────────────────────────

export function buildV2TrimScopeRows(rows: Unsafe[], roomIds: Set<string>) {
  const positionByRoom = new Map<string, number>()
  const scopeRows = rows.map((row, idx) => {
    const roomId = asText(row.room_id).toUpperCase()
    if (!roomId || !roomIds.has(roomId)) {
      throw new Error(`Trim scope ${idx + 1}: room is missing or invalid`)
    }
    const nextPosition = positionByRoom.get(roomId) ?? 0
    positionByRoom.set(roomId, nextPosition + 1)

    return normalizeEstimateV2TrimScopeRow(
      { ...row, id: saveRowId(row), room_id: roomId, position: nextPosition },
      nextPosition
    ) satisfies V2TrimScopeSaveRow
  })

  return {
    scopeRows,
    scopeIds: new Set(
      scopeRows
        .map((row) => row.id)
        .filter((value): value is string => !!value)
    ),
  }
}

// ─── Door scope builders ─────────────────────────────────────────────────────

export function buildV2DoorScopeRows(rows: Unsafe[], roomIds: Set<string>) {
  const positionByRoom = new Map<string, number>()
  const scopeRows = rows.map((row, idx) => {
    const roomId = asText(row.room_id).toUpperCase()
    if (!roomId || !roomIds.has(roomId)) {
      throw new Error(`Door scope ${idx + 1}: room is missing or invalid`)
    }
    const nextPosition = positionByRoom.get(roomId) ?? 0
    positionByRoom.set(roomId, nextPosition + 1)
    const sides = asNullableNumber(row.sides)
    if (sides != null && sides !== 1 && sides !== 2) {
      throw new Error(`Door scope ${idx + 1}: sides must be 1 or 2`)
    }

    return normalizeEstimateV2DoorScopeRow(
      { ...row, id: saveRowId(row), room_id: roomId, position: nextPosition, sides },
      nextPosition
    ) satisfies V2DoorScopeSaveRow
  })

  return {
    scopeRows,
    scopeIds: new Set(
      scopeRows
        .map((row) => row.id)
        .filter((value): value is string => !!value)
    ),
  }
}

function toDrywallSurface(value: unknown): 'wall' | 'ceiling' {
  return asText(value).toLowerCase() === 'ceiling' ? 'ceiling' : 'wall'
}

function toDrywallRepairType(value: unknown) {
  const raw = asText(value).toLowerCase()
  if (
    raw === 'corner_tape_replacement' ||
    raw === 'flat_wall_crack' ||
    raw === 'stress_crack_at_seam' ||
    raw === 'ceiling_crack' ||
    raw === 'patch_opening_repair'
  ) {
    return raw
  }
  return ''
}

function drywallUnitForRepairType(repairType: string): 'LF' | 'SQFT' {
  return repairType === 'patch_opening_repair' ? 'SQFT' : 'LF'
}

function isDrywallRepairValidForSurface(repairType: string, surface: 'wall' | 'ceiling') {
  if (surface === 'ceiling') return repairType === 'ceiling_crack' || repairType === 'patch_opening_repair'
  return (
    repairType === 'corner_tape_replacement' ||
    repairType === 'flat_wall_crack' ||
    repairType === 'stress_crack_at_seam' ||
    repairType === 'patch_opening_repair'
  )
}

export function buildV2DrywallRepairRows(rows: Unsafe[], roomIds: Set<string>) {
  const positionByRoomSurface = new Map<string, number>()
  const repairRows = rows.map((row, idx) => {
    const roomId = asText(row.room_id).toUpperCase()
    if (!roomId || !roomIds.has(roomId)) {
      throw new Error(`Drywall repair ${idx + 1}: room is missing or invalid`)
    }
    const surface = toDrywallSurface(row.surface)
    const repairType = toDrywallRepairType(row.repair_type)
    if (!repairType) {
      throw new Error(`Drywall repair ${idx + 1}: repair type is required`)
    }
    if (!isDrywallRepairValidForSurface(repairType, surface)) {
      throw new Error(`Drywall repair ${idx + 1}: ${repairType} is not valid for ${surface}`)
    }
    const quantity = asNullableNumber(row.quantity)
    if (quantity == null || quantity < 0) {
      throw new Error(`Drywall repair ${idx + 1}: quantity must be numeric and not negative`)
    }
    const positionKey = `${roomId}:${surface}`
    const nextPosition = positionByRoomSurface.get(positionKey) ?? 0
    positionByRoomSurface.set(positionKey, nextPosition + 1)
    return normalizeEstimateV2DrywallRepairRow(
      {
        ...row,
        id: saveRowId(row),
        room_id: roomId,
        position: nextPosition,
        surface,
        repair_type: repairType,
        unit: drywallUnitForRepairType(repairType),
        quantity,
      },
      nextPosition
    ) satisfies V2DrywallRepairSaveRow
  })

  return {
    repairRows,
    repairIds: new Set(
      repairRows
        .map((row) => row.id)
        .filter((value): value is string => !!value)
    ),
  }
}

// ─── Catalog builders ─────────────────────────────────────────────────────────

export function toWallCalculationCatalogs(raw: Unsafe | null | undefined): WallCalculationCatalogs {
  return toSharedWallCalculationCatalogs(raw)
}

export function toCeilingCalculationCatalogs(raw: Unsafe | null | undefined) {
  return toSharedCeilingCalculationCatalogs(raw)
}

export function toTrimCalculationCatalogs(raw: Unsafe | null | undefined) {
  return toSharedTrimCalculationCatalogs(raw)
}

export function toDoorCalculationCatalogs(raw: Unsafe | null | undefined) {
  return toSharedDoorCalculationCatalogs(raw)
}

export function toDrywallCalculationCatalogs(raw: Unsafe | null | undefined) {
  return toSharedDrywallCalculationCatalogs(raw)
}
