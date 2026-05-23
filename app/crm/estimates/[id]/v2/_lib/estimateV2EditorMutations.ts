import { sortByPosition } from '../../../../../../lib/estimator/v2DraftPayload.ts'
import { isBaseTrimType } from '../../../../../../lib/estimator/trimTypeMetadata.ts'
import {
  buildV2TrimActivationDefaults,
  isV2TrimRoomHelperEligible,
  normalizeV2TrimHelperMode,
  V2_TRIM_ROOM_HELPER_SOURCE,
} from '../../../../../../lib/estimator/v2TrimActivation.ts'
import type { EstimateV2TrimTypeOption } from '@/types/estimator/v2Catalogs'
import type { EstimateV2RoomDraft, EstimateV2RoomFlagDraft } from '@/types/estimator/v2Rooms'
import type {
  EstimateV2CeilingScopeDraft,
  EstimateV2CeilingScopeMode,
  EstimateV2CeilingSegmentDraft,
  EstimateV2DoorScopeDraft,
  EstimateV2DrywallRepairDraft,
  EstimateV2TrimScopeDraft,
  EstimateV2TrimUnitType,
  EstimateV2WallScopeDraft,
  EstimateV2WallScopeMode,
  EstimateV2WallSegmentDraft,
} from '@/types/estimator/v2Scopes'
import {
  createDefaultCeilingScope,
  createDefaultCeilingSegment,
  createDefaultDoorScope,
  createDefaultDrywallRepair,
  createDefaultRoom,
  createDefaultScope,
  createDefaultSegment,
  createDefaultTrimScope,
  createUuid,
  isCrownTrimType,
  moveItem,
  numberOrNull,
} from './estimateV2EditorNormalize.ts'

export function reindexByPosition<T extends { position: number }>(rows: T[]) {
  return sortByPosition(rows).map((row, index) => ({ ...row, position: index }))
}

export function addRoomMutation(params: {
  rooms: EstimateV2RoomDraft[]
  defaultHeightFactor: string
}) {
  const room = createDefaultRoom(params.rooms)
  const scope = {
    ...createDefaultScope(room.roomId, 'RECT'),
    heightFactor: params.defaultHeightFactor,
  }
  return {
    room,
    rooms: [...params.rooms, room],
    scopes: [scope],
  }
}

export function updateRoomMutation(
  rooms: EstimateV2RoomDraft[],
  roomId: string,
  patch: Partial<EstimateV2RoomDraft>
) {
  return rooms.map((room) => (room.roomId === roomId ? { ...room, ...patch } : room))
}

export function updateRoomDimensionsMutation(params: {
  rooms: EstimateV2RoomDraft[]
  scopes: EstimateV2WallScopeDraft[]
  ceilingScopes?: EstimateV2CeilingScopeDraft[]
  roomId: string
  field: 'lengthIn' | 'widthIn' | 'heightIn'
  value: string
}) {
  const rooms = updateRoomMutation(params.rooms, params.roomId, { [params.field]: params.value })
  const room = rooms.find((entry) => entry.roomId === params.roomId)
  if (!room) return { rooms, scopes: params.scopes, ceilingScopes: params.ceilingScopes }

  const lengthIn = numberOrNull(room.lengthIn)
  const widthIn = numberOrNull(room.widthIn)
  const firstRectScope = sortByPosition(params.scopes.filter((scope) => scope.roomId === params.roomId)).find(
    (scope) => scope.mode === 'RECT'
  )

  const scopePatch: Partial<EstimateV2WallScopeDraft> = {}
  if (lengthIn != null && widthIn != null) scopePatch.perimeterIn = String(2 * (lengthIn + widthIn))
  if (params.field === 'heightIn') scopePatch.heightIn = params.value
  const scopes =
    firstRectScope && Object.keys(scopePatch).length > 0
      ? params.scopes.map((scope) =>
          scope.id === firstRectScope.id ? { ...scope, ...scopePatch } : scope
        )
      : params.scopes

  const shouldSyncCeilingGeometry = params.field === 'lengthIn' || params.field === 'widthIn'
  const ceilingScopes =
    params.ceilingScopes && shouldSyncCeilingGeometry
      ? params.ceilingScopes.map((scope) =>
          scope.roomId === params.roomId && scope.mode === 'RECT'
            ? { ...scope, lengthIn: room.lengthIn, widthIn: room.widthIn }
            : scope
        )
      : params.ceilingScopes

  return {
    rooms,
    scopes,
    ceilingScopes,
  }
}

export function deleteRoomCascadeMutation(params: {
  rooms: EstimateV2RoomDraft[]
  scopes: EstimateV2WallScopeDraft[]
  segments: EstimateV2WallSegmentDraft[]
  roomFlags: EstimateV2RoomFlagDraft[]
  ceilingScopes: EstimateV2CeilingScopeDraft[]
  ceilingSegments: EstimateV2CeilingSegmentDraft[]
  trimScopes: EstimateV2TrimScopeDraft[]
  doorScopes?: EstimateV2DoorScopeDraft[]
  drywallRepairs?: EstimateV2DrywallRepairDraft[]
  roomId: string
  selectedRoomId: string
}) {
  const rooms = reindexByPosition(params.rooms.filter((room) => room.roomId !== params.roomId))
  const nextSelectedRoomId =
    params.selectedRoomId === params.roomId ? rooms[0]?.roomId ?? '' : params.selectedRoomId

  return {
    rooms,
    scopes: params.scopes.filter((scope) => scope.roomId !== params.roomId),
    segments: params.segments.filter((segment) => segment.roomId !== params.roomId),
    roomFlags: params.roomFlags.filter((flag) => flag.roomId !== params.roomId),
    ceilingScopes: params.ceilingScopes.filter((scope) => scope.roomId !== params.roomId),
    ceilingSegments: params.ceilingSegments.filter((segment) => segment.roomId !== params.roomId),
    trimScopes: params.trimScopes.filter((scope) => scope.roomId !== params.roomId),
    doorScopes: (params.doorScopes ?? []).filter((scope) => scope.roomId !== params.roomId),
    drywallRepairs: (params.drywallRepairs ?? []).filter(
      (repair) => repair.roomId !== params.roomId
    ),
    selectedRoomId: nextSelectedRoomId,
  }
}

export function toggleRoomFlagMutation(
  roomFlags: EstimateV2RoomFlagDraft[],
  roomId: string,
  flagId: string
) {
  const existing = roomFlags.find((flag) => flag.roomId === roomId && flag.flagId === flagId)
  if (existing) {
    return roomFlags.filter((flag) => !(flag.roomId === roomId && flag.flagId === flagId))
  }
  const nextPosition =
    roomFlags
      .filter((flag) => flag.roomId === roomId)
      .reduce((maxPosition, flag) => Math.max(maxPosition, flag.position), -1) + 1
  return [...roomFlags, { id: createUuid(), roomId, flagId, position: nextPosition }]
}

export function updateWallScopeMutation(
  scopes: EstimateV2WallScopeDraft[],
  scopeId: string,
  patch: Partial<EstimateV2WallScopeDraft>
) {
  return scopes.map((scope) => (scope.id === scopeId ? { ...scope, ...patch } : scope))
}

function forceSegmentCeilingScopeFlat(scope: EstimateV2CeilingScopeDraft): EstimateV2CeilingScopeDraft {
  return {
    ...scope,
    mode: 'SEG',
    ceilingTypeId: 'FLAT',
    ceilingGeometryMode: 'FLAT',
    lengthIn: '',
    widthIn: '',
    areaSf: '',
    vaultedAreaFactor: '',
    vaultedRidgeLengthIn: '',
    vaultedSlopeLengthIn: '',
    vaultedPlaneCount: '',
    trayPerimeterIn: '',
    trayStepHeightIn: '',
    trayBandWidthIn: '',
    cofferSectionLengthIn: '',
    cofferSectionWidthIn: '',
    cofferSectionCount: '',
    cofferFaceHeightIn: '',
    cofferBottomWidthIn: '',
  }
}

export function syncWallCutInFromTrayCeilings(params: {
  wallScopes: EstimateV2WallScopeDraft[]
  ceilingScopes: EstimateV2CeilingScopeDraft[]
}) {
  void params.ceilingScopes
  return params.wallScopes
}

export function addWallScopeMutation(params: {
  scopes: EstimateV2WallScopeDraft[]
  roomId: string
  defaultHeightFactor: string
}) {
  const roomScopes = sortByPosition(params.scopes.filter((scope) => scope.roomId === params.roomId))
  const nextScope = createDefaultScope(params.roomId, 'SEG')
  nextScope.heightFactor = params.defaultHeightFactor
  nextScope.position = roomScopes.length
  return [...params.scopes, nextScope]
}

export function moveWallScopeMutation(params: {
  scopes: EstimateV2WallScopeDraft[]
  roomId: string
  scopeId: string
  direction: -1 | 1
}) {
  const roomScopes = sortByPosition(params.scopes.filter((scope) => scope.roomId === params.roomId))
  const index = roomScopes.findIndex((scope) => scope.id === params.scopeId)
  if (index === -1) return params.scopes
  const reordered = moveItem(roomScopes, index, index + params.direction).map((scope, position) => ({
    ...scope,
    position,
  }))
  return [...params.scopes.filter((scope) => scope.roomId !== params.roomId), ...reordered]
}

export function deleteWallScopeMutation(params: {
  scopes: EstimateV2WallScopeDraft[]
  segments: EstimateV2WallSegmentDraft[]
  roomId: string
  scopeId: string
}) {
  const roomScopes = reindexByPosition(
    params.scopes.filter((scope) => scope.roomId === params.roomId && scope.id !== params.scopeId)
  )
  return {
    scopes: [...params.scopes.filter((scope) => scope.roomId !== params.roomId && scope.id !== params.scopeId), ...roomScopes],
    segments: params.segments.filter((segment) => segment.wallScopeId !== params.scopeId),
  }
}

export function addWallSegmentMutation(
  segments: EstimateV2WallSegmentDraft[],
  roomId: string,
  wallScopeId: string
) {
  const scopeSegments = sortByPosition(segments.filter((segment) => segment.wallScopeId === wallScopeId))
  const nextSegment = createDefaultSegment(roomId, wallScopeId)
  nextSegment.position = scopeSegments.length
  return [...segments, nextSegment]
}

export function moveWallSegmentMutation(params: {
  segments: EstimateV2WallSegmentDraft[]
  wallScopeId: string
  segmentId: string
  direction: -1 | 1
}) {
  const scopeSegments = sortByPosition(params.segments.filter((segment) => segment.wallScopeId === params.wallScopeId))
  const index = scopeSegments.findIndex((segment) => segment.id === params.segmentId)
  if (index === -1) return params.segments
  const reordered = moveItem(scopeSegments, index, index + params.direction).map((segment, position) => ({
    ...segment,
    position,
  }))
  return [...params.segments.filter((segment) => segment.wallScopeId !== params.wallScopeId), ...reordered]
}

export function deleteWallSegmentMutation(
  segments: EstimateV2WallSegmentDraft[],
  wallScopeId: string,
  segmentId: string
) {
  const remaining = sortByPosition(
    segments.filter((segment) => !(segment.wallScopeId === wallScopeId && segment.id === segmentId))
  )
  const roomSegments = remaining
    .filter((segment) => segment.wallScopeId === wallScopeId)
    .map((segment, position) => ({ ...segment, position }))
  return [...remaining.filter((segment) => segment.wallScopeId !== wallScopeId), ...roomSegments]
}

export function toggleRoomWallIncludeMutation(params: {
  scopes: EstimateV2WallScopeDraft[]
  roomId: string
  roomMode: EstimateV2WallScopeMode
  defaultHeightFactor: string
}) {
  const roomScopes = sortByPosition(params.scopes.filter((scope) => scope.roomId === params.roomId))
  if (roomScopes.length === 0) {
    const nextScope = createDefaultScope(params.roomId, params.roomMode)
    nextScope.heightFactor = params.defaultHeightFactor
    nextScope.include = 'Y'
    return [...params.scopes, nextScope]
  }
  const nextInclude: 'Y' | 'N' = roomScopes.some((scope) => scope.include === 'Y') ? 'N' : 'Y'
  const scopeIds = new Set(roomScopes.map((scope) => scope.id))
  return params.scopes.map((scope) => (scopeIds.has(scope.id) ? { ...scope, include: nextInclude } : scope))
}

export function applyWallRoomModeMutation(params: {
  scopes: EstimateV2WallScopeDraft[]
  segments: EstimateV2WallSegmentDraft[]
  roomId: string
  nextMode: EstimateV2WallScopeMode
  defaultHeightFactor: string
}): { scopes: EstimateV2WallScopeDraft[]; segments: EstimateV2WallSegmentDraft[] } {
  const roomScopes = sortByPosition(params.scopes.filter((scope) => scope.roomId === params.roomId))
  const currentMode = roomScopes[0]?.mode ?? 'RECT'

  if (roomScopes.length === 0) {
    const nextScope = createDefaultScope(params.roomId, params.nextMode)
    nextScope.heightFactor = params.defaultHeightFactor
    return { scopes: [...params.scopes, nextScope], segments: params.segments }
  }

  if (currentMode === params.nextMode) {
    return { scopes: params.scopes, segments: params.segments }
  }

  if (currentMode === 'RECT' && params.nextMode === 'SEG') {
    return {
      scopes: params.scopes.map((scope) =>
        scope.id === roomScopes[0].id
          ? {
              ...scope,
              mode: 'SEG',
              perimeterIn: '',
              standardDoorCount: '',
              standardWindowCount: '',
              position: 0,
            }
          : scope
      ),
      segments: params.segments,
    }
  }

  const freshScope = createDefaultScope(params.roomId, 'RECT')
  freshScope.heightFactor = params.defaultHeightFactor
  const roomScopeIds = new Set(roomScopes.map((scope) => scope.id))
  return {
    scopes: [...params.scopes.filter((scope) => scope.roomId !== params.roomId), freshScope],
    segments: params.segments.filter((segment) => !roomScopeIds.has(segment.wallScopeId)),
  }
}

export function updateCeilingScopeMutation(
  scopes: EstimateV2CeilingScopeDraft[],
  scopeId: string,
  patch: Partial<EstimateV2CeilingScopeDraft>
) {
  return scopes.map((scope) => (scope.id === scopeId ? { ...scope, ...patch } : scope))
}

export function addCeilingScopeMutation(params: {
  scopes: EstimateV2CeilingScopeDraft[]
  roomId: string
  defaultHeightFactor: string
}) {
  const roomScopes = sortByPosition(params.scopes.filter((scope) => scope.roomId === params.roomId))
  const nextScope = createDefaultCeilingScope(params.roomId, 'SEG')
  nextScope.heightFactor = params.defaultHeightFactor
  nextScope.position = roomScopes.length
  return [...params.scopes, nextScope]
}

export function deleteCeilingScopeMutation(params: {
  scopes: EstimateV2CeilingScopeDraft[]
  segments: EstimateV2CeilingSegmentDraft[]
  roomId: string
  scopeId: string
}) {
  const roomScopes = reindexByPosition(
    params.scopes.filter((scope) => scope.roomId === params.roomId && scope.id !== params.scopeId)
  )
  return {
    scopes: [...params.scopes.filter((scope) => scope.roomId !== params.roomId && scope.id !== params.scopeId), ...roomScopes],
    segments: params.segments.filter((segment) => segment.ceilingScopeId !== params.scopeId),
  }
}

export function moveCeilingScopeMutation(params: {
  scopes: EstimateV2CeilingScopeDraft[]
  roomId: string
  scopeId: string
  direction: -1 | 1
}) {
  const roomScopes = sortByPosition(params.scopes.filter((scope) => scope.roomId === params.roomId))
  const index = roomScopes.findIndex((scope) => scope.id === params.scopeId)
  if (index === -1) return params.scopes
  const reordered = moveItem(roomScopes, index, index + params.direction).map((scope, position) => ({
    ...scope,
    position,
  }))
  return [...params.scopes.filter((scope) => scope.roomId !== params.roomId), ...reordered]
}

export function addCeilingSegmentMutation(
  segments: EstimateV2CeilingSegmentDraft[],
  roomId: string,
  ceilingScopeId: string
) {
  const scopeSegments = sortByPosition(segments.filter((segment) => segment.ceilingScopeId === ceilingScopeId))
  const nextSegment = createDefaultCeilingSegment(roomId, ceilingScopeId)
  nextSegment.position = scopeSegments.length
  return [...segments, nextSegment]
}

export function deleteCeilingSegmentMutation(
  segments: EstimateV2CeilingSegmentDraft[],
  ceilingScopeId: string,
  segmentId: string
) {
  const remaining = sortByPosition(
    segments.filter((segment) => !(segment.ceilingScopeId === ceilingScopeId && segment.id === segmentId))
  )
  const scopeSegments = remaining
    .filter((segment) => segment.ceilingScopeId === ceilingScopeId)
    .map((segment, position) => ({ ...segment, position }))
  return [...remaining.filter((segment) => segment.ceilingScopeId !== ceilingScopeId), ...scopeSegments]
}

export function moveCeilingSegmentMutation(params: {
  segments: EstimateV2CeilingSegmentDraft[]
  ceilingScopeId: string
  segmentId: string
  direction: -1 | 1
}) {
  const scopeSegments = sortByPosition(params.segments.filter((segment) => segment.ceilingScopeId === params.ceilingScopeId))
  const index = scopeSegments.findIndex((segment) => segment.id === params.segmentId)
  if (index === -1) return params.segments
  const reordered = moveItem(scopeSegments, index, index + params.direction).map((segment, position) => ({
    ...segment,
    position,
  }))
  return [...params.segments.filter((segment) => segment.ceilingScopeId !== params.ceilingScopeId), ...reordered]
}

export function updateCeilingSegmentMutation(
  segments: EstimateV2CeilingSegmentDraft[],
  segmentId: string,
  patch: Partial<EstimateV2CeilingSegmentDraft>
) {
  return segments.map((segment) => (segment.id === segmentId ? { ...segment, ...patch } : segment))
}

export function toggleRoomCeilingIncludeMutation(params: {
  scopes: EstimateV2CeilingScopeDraft[]
  roomId: string
  roomMode: EstimateV2CeilingScopeMode
  defaultHeightFactor: string
}) {
  const roomScopes = sortByPosition(params.scopes.filter((scope) => scope.roomId === params.roomId))
  if (roomScopes.length === 0) {
    const nextScope = createDefaultCeilingScope(params.roomId, params.roomMode)
    nextScope.heightFactor = params.defaultHeightFactor
    nextScope.include = 'Y'
    return [...params.scopes, params.roomMode === 'SEG' ? forceSegmentCeilingScopeFlat(nextScope) : nextScope]
  }
  const nextInclude: 'Y' | 'N' = roomScopes.some((scope) => scope.include === 'Y') ? 'N' : 'Y'
  const scopeIds = new Set(roomScopes.map((scope) => scope.id))
  return params.scopes.map((scope) => (scopeIds.has(scope.id) ? { ...scope, include: nextInclude } : scope))
}

export function applyCeilingRoomModeMutation(params: {
  scopes: EstimateV2CeilingScopeDraft[]
  segments: EstimateV2CeilingSegmentDraft[]
  roomId: string
  nextMode: EstimateV2CeilingScopeMode
  defaultHeightFactor: string
}): { scopes: EstimateV2CeilingScopeDraft[]; segments: EstimateV2CeilingSegmentDraft[] } {
  const roomScopes = sortByPosition(params.scopes.filter((scope) => scope.roomId === params.roomId))
  const currentMode = roomScopes[0]?.mode ?? null

  if (roomScopes.length === 0) {
    const nextScope = createDefaultCeilingScope(params.roomId, params.nextMode)
    nextScope.heightFactor = params.defaultHeightFactor
    return {
      scopes: [
        ...params.scopes,
        params.nextMode === 'SEG' ? forceSegmentCeilingScopeFlat(nextScope) : nextScope,
      ],
      segments: params.segments,
    }
  }

  if (currentMode === params.nextMode) {
    if (params.nextMode === 'SEG') {
      const roomScopeIds = new Set(roomScopes.map((scope) => scope.id))
      return {
        scopes: params.scopes.map((scope) =>
          roomScopeIds.has(scope.id) ? forceSegmentCeilingScopeFlat(scope) : scope
        ),
        segments: params.segments,
      }
    }
    return { scopes: params.scopes, segments: params.segments }
  }

  if (currentMode === 'RECT' && params.nextMode === 'SEG') {
    return {
      scopes: params.scopes.map((scope) =>
        scope.id === roomScopes[0].id
          ? { ...forceSegmentCeilingScopeFlat(scope), position: 0 }
          : scope
      ),
      segments: params.segments,
    }
  }

  const freshScope = createDefaultCeilingScope(params.roomId, 'RECT')
  freshScope.heightFactor = params.defaultHeightFactor
  const roomScopeIds = new Set(roomScopes.map((scope) => scope.id))
  return {
    scopes: [...params.scopes.filter((scope) => scope.roomId !== params.roomId), freshScope],
    segments: params.segments.filter((segment) => !roomScopeIds.has(segment.ceilingScopeId)),
  }
}

export function updateTrimScopeMutation(
  scopes: EstimateV2TrimScopeDraft[],
  scopeId: string,
  patch: Partial<EstimateV2TrimScopeDraft>
) {
  return scopes.map((scope) => (scope.id === scopeId ? { ...scope, ...patch } : scope))
}

export function addTrimScopeMutation(scopes: EstimateV2TrimScopeDraft[], roomId: string) {
  const roomScopes = sortByPosition(scopes.filter((scope) => scope.roomId === roomId))
  const nextScope = createDefaultTrimScope(roomId)
  nextScope.position = roomScopes.length
  return [...scopes, nextScope]
}

export function moveTrimScopeMutation(params: {
  scopes: EstimateV2TrimScopeDraft[]
  roomId: string
  scopeId: string
  direction: -1 | 1
}) {
  const roomScopes = sortByPosition(params.scopes.filter((scope) => scope.roomId === params.roomId))
  const index = roomScopes.findIndex((scope) => scope.id === params.scopeId)
  if (index === -1) return params.scopes
  const reordered = moveItem(roomScopes, index, index + params.direction).map((scope, position) => ({
    ...scope,
    position,
  }))
  return [...params.scopes.filter((scope) => scope.roomId !== params.roomId), ...reordered]
}

export function deleteTrimScopeMutation(
  scopes: EstimateV2TrimScopeDraft[],
  roomId: string,
  scopeId: string
) {
  const remaining = scopes.filter((scope) => !(scope.roomId === roomId && scope.id === scopeId))
  const roomScopes = reindexByPosition(remaining.filter((scope) => scope.roomId === roomId))
  return [...remaining.filter((scope) => scope.roomId !== roomId), ...roomScopes]
}

type ToggleRoomTrimIncludeOptions = {
  rooms?: EstimateV2RoomDraft[]
  trimTypeOptions?: EstimateV2TrimTypeOption[]
  roomModeById?: Map<string, 'RECT' | 'SEG'>
  roomHeightFactorByRoomId?: Map<string, string>
}

export function toggleRoomTrimIncludeMutation(
  scopes: EstimateV2TrimScopeDraft[],
  roomId: string,
  options?: ToggleRoomTrimIncludeOptions
): EstimateV2TrimScopeDraft[] {
  const roomScopes = sortByPosition(scopes.filter((scope) => scope.roomId === roomId))
  if (roomScopes.length === 0) {
    const defaultTrimType = options?.trimTypeOptions?.[0]
    if (!defaultTrimType) return scopes
    const nextScope = createDefaultTrimScope(roomId)
    nextScope.include = 'Y'
    const roomMode = options?.roomModeById?.get(roomId) ?? 'RECT'
    const typedScopes = applyTrimTypeMutation({
      scopes: [nextScope],
      scopeId: nextScope.id,
      trimTypeId: defaultTrimType.id,
      trimTypeOptions: options?.trimTypeOptions ?? [],
      roomModeById: options?.roomModeById ?? new Map([[roomId, roomMode]]),
      roomHeightFactorByRoomId: options?.roomHeightFactorByRoomId ?? new Map(),
    })
    const typedScope = typedScopes[0] ?? nextScope
    return [
      ...scopes,
      {
        ...typedScope,
        ...buildV2TrimActivationDefaults({
          scope: typedScope,
          room: options?.rooms?.find((entry) => entry.roomId === roomId),
          roomMode,
          trimType: options?.trimTypeOptions?.find((option) => option.id === typedScope.trimTypeId),
          fallbackTrimType: options?.trimTypeOptions?.[0],
        }),
      },
    ]
  }
  const hasIncluded = roomScopes.some((scope) => scope.include === 'Y')
  if (hasIncluded) {
    return scopes.map((scope) => (scope.roomId === roomId ? { ...scope, include: 'N' } : scope))
  }

  return scopes.map((scope) => {
    if (scope.roomId !== roomId) return scope
    return {
      ...scope,
      include: 'Y',
      ...buildV2TrimActivationDefaults({
        scope,
        room: options?.rooms?.find((entry) => entry.roomId === roomId),
        roomMode: options?.roomModeById?.get(roomId) ?? 'RECT',
        trimType: options?.trimTypeOptions?.find((option) => option.id === scope.trimTypeId),
        fallbackTrimType: options?.trimTypeOptions?.[0],
      }),
    }
  })
}

export function updateDoorScopeMutation(
  scopes: EstimateV2DoorScopeDraft[],
  scopeId: string,
  patch: Partial<EstimateV2DoorScopeDraft>
) {
  return scopes.map((scope) => (scope.id === scopeId ? { ...scope, ...patch } : scope))
}

export function addDoorScopeMutation(scopes: EstimateV2DoorScopeDraft[], roomId: string) {
  const roomScopes = sortByPosition(scopes.filter((scope) => scope.roomId === roomId))
  const nextScope = createDefaultDoorScope(roomId)
  nextScope.position = roomScopes.length
  return [...scopes, nextScope]
}

export function moveDoorScopeMutation(params: {
  scopes: EstimateV2DoorScopeDraft[]
  roomId: string
  scopeId: string
  direction: -1 | 1
}) {
  const roomScopes = sortByPosition(params.scopes.filter((scope) => scope.roomId === params.roomId))
  const index = roomScopes.findIndex((scope) => scope.id === params.scopeId)
  if (index === -1) return params.scopes
  const reordered = moveItem(roomScopes, index, index + params.direction).map((scope, position) => ({
    ...scope,
    position,
  }))
  return [...params.scopes.filter((scope) => scope.roomId !== params.roomId), ...reordered]
}

export function deleteDoorScopeMutation(
  scopes: EstimateV2DoorScopeDraft[],
  roomId: string,
  scopeId: string
) {
  const remaining = scopes.filter((scope) => !(scope.roomId === roomId && scope.id === scopeId))
  const roomScopes = reindexByPosition(remaining.filter((scope) => scope.roomId === roomId))
  return [...remaining.filter((scope) => scope.roomId !== roomId), ...roomScopes]
}

export function toggleRoomDoorIncludeMutation(
  scopes: EstimateV2DoorScopeDraft[],
  roomId: string,
  options?: {
    doorTypeOptions?: Array<{ id: string; label: string }>
  }
): EstimateV2DoorScopeDraft[] {
  const roomScopes = sortByPosition(scopes.filter((scope) => scope.roomId === roomId))
  if (roomScopes.length === 0) {
    const defaultDoorType = options?.doorTypeOptions?.[0]
    if (!defaultDoorType) return scopes
    const nextScope = createDefaultDoorScope(roomId)
    nextScope.include = 'Y'
    nextScope.scopeName = defaultDoorType.label
    nextScope.doorTypeId = defaultDoorType.id
    nextScope.quantity = '1'
    nextScope.sides = '2'
    return [...scopes, nextScope]
  }
  const hasIncluded = roomScopes.some((scope) => scope.include === 'Y')
  if (hasIncluded) {
    return scopes.map((scope) => (scope.roomId === roomId ? { ...scope, include: 'N' } : scope))
  }

  return scopes.map((scope) => {
    if (scope.roomId !== roomId) return scope
    const doorType =
      options?.doorTypeOptions?.find((option) => option.id === scope.doorTypeId) ??
      options?.doorTypeOptions?.[0]
    return {
      ...scope,
      include: 'Y',
      doorTypeId: scope.doorTypeId || doorType?.id || '',
      scopeName: scope.scopeName || doorType?.label || '',
      quantity: numberOrNull(scope.quantity) != null && Number(scope.quantity) > 0 ? scope.quantity : '1',
      sides: scope.sides === '1' || scope.sides === '2' ? scope.sides : '2',
    }
  })
}

export function addDrywallRepairMutation(params: {
  repairs: EstimateV2DrywallRepairDraft[]
  roomId: string
  surface: EstimateV2DrywallRepairDraft['surface']
  repairType: string
}) {
  const roomRepairs = sortByPosition(
    params.repairs.filter(
      (repair) => repair.roomId === params.roomId && repair.surface === params.surface
    )
  )
  const nextRepair = createDefaultDrywallRepair(params.roomId, params.surface, params.repairType)
  nextRepair.position = roomRepairs.length
  return [...params.repairs, nextRepair]
}

export function updateDrywallRepairMutation(
  repairs: EstimateV2DrywallRepairDraft[],
  repairId: string,
  patch: Partial<EstimateV2DrywallRepairDraft>
) {
  return repairs.map((repair) => (repair.id === repairId ? { ...repair, ...patch } : repair))
}

export function deleteDrywallRepairMutation(
  repairs: EstimateV2DrywallRepairDraft[],
  roomId: string,
  repairId: string
) {
  const deleted = repairs.find((repair) => repair.id === repairId)
  const surface = deleted?.surface
  const remaining = repairs.filter((repair) => !(repair.roomId === roomId && repair.id === repairId))
  if (!surface) return remaining
  const roomSurfaceRepairs = reindexByPosition(
    remaining.filter((repair) => repair.roomId === roomId && repair.surface === surface)
  )
  return [
    ...remaining.filter((repair) => !(repair.roomId === roomId && repair.surface === surface)),
    ...roomSurfaceRepairs,
  ]
}

export function stripInvalidTrimHelperModeMutation(params: {
  scopes: EstimateV2TrimScopeDraft[]
  roomModeById: Map<string, 'RECT' | 'SEG'>
  trimTypeOptions: EstimateV2TrimTypeOption[]
}): EstimateV2TrimScopeDraft[] {
  let changed = false
  const next = params.scopes.map((scope) => {
    const roomMode = params.roomModeById.get(scope.roomId) ?? 'RECT'
    const trimType = params.trimTypeOptions.find((item) => item.id === scope.trimTypeId)
    if (scope.measurementMode !== 'ROOM_HELPER') return scope
    const normalized = normalizeV2TrimHelperMode({
      measurementMode: scope.measurementMode,
      helperSource: scope.helperSource,
      helperValue: scope.helperValue,
      roomMode,
      trimTypeHelperAllowed: !!trimType?.helper_allowed,
      emptyHelperSource: '' as const,
    })
    if (
      normalized.measurementMode === scope.measurementMode &&
      normalized.helperSource === scope.helperSource &&
      normalized.helperValue === scope.helperValue
    ) {
      return scope
    }
    changed = true
    return { ...scope, ...normalized }
  })
  return changed ? next : params.scopes
}

export function applyTrimTypeMutation(params: {
  scopes: EstimateV2TrimScopeDraft[]
  scopeId: string
  trimTypeId: string
  trimTypeOptions: EstimateV2TrimTypeOption[]
  roomModeById: Map<string, 'RECT' | 'SEG'>
  roomHeightFactorByRoomId: Map<string, string>
}): EstimateV2TrimScopeDraft[] {
  const trimType = params.trimTypeOptions.find((item) => item.id === params.trimTypeId)
  return params.scopes.map((scope) => {
    if (scope.id !== params.scopeId) return scope
    const roomMode = params.roomModeById.get(scope.roomId) ?? 'RECT'
    const helperAllowed = isV2TrimRoomHelperEligible({
      roomMode,
      trimTypeHelperAllowed: !!trimType?.helper_allowed,
    })
    const keepHelperMode = helperAllowed && scope.measurementMode === 'ROOM_HELPER'
    const isCrown = isCrownTrimType(trimType, scope)
    const nextUnitType = (trimType?.unit_type ?? scope.unitType ?? 'LF') as EstimateV2TrimUnitType
    const isBaseboard =
      nextUnitType === 'LF' &&
      isBaseTrimType({
        id: params.trimTypeId,
        label: trimType?.label ?? scope.scopeName,
        family: trimType?.family ?? scope.trimFamily,
        category: trimType?.category,
        trimCategory: trimType?.trim_category,
        pickerGroup: trimType?.picker_group,
        unitType: nextUnitType,
      })
    return {
      ...scope,
      trimTypeId: params.trimTypeId,
      trimFamily: (trimType?.family ?? trimType?.category ?? scope.trimFamily ?? '').toUpperCase(),
      unitType: nextUnitType,
      productionRateId: trimType?.default_production_rate_id ?? params.trimTypeId ?? scope.productionRateId,
      measurementMode: keepHelperMode ? 'ROOM_HELPER' : 'MANUAL',
      helperSource: keepHelperMode ? V2_TRIM_ROOM_HELPER_SOURCE : '',
      baseboardOpeningCount: isBaseboard ? scope.baseboardOpeningCount : '',
      heightFactor: isCrown ? params.roomHeightFactorByRoomId.get(scope.roomId) ?? '1' : '1',
    }
  })
}
