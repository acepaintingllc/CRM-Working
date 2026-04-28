'use client'

import { useMemo } from 'react'
import {
  buildCeilingScopeByRoomId,
  buildDoorScopeByRoomId,
  buildRoomComplexityFactorByRoomId,
  buildRoomFlagFactorByRoomId,
  buildRoomHeightFactorByRoomId,
  buildTrimScopeByRoomId,
  buildWallScopeByRoomId,
} from '../_lib/estimateV2EditorDerived'
import { resolveRoomModeById } from '../_lib/estimateV2EditorNormalize'
import type {
  EstimateV2EditorCollections,
  EstimateV2EditorMetaState,
} from './estimateV2EditorTypes'

export function useEstimateV2RoomDerived(params: {
  collections: Pick<
    EstimateV2EditorCollections,
    'rooms' | 'scopes' | 'roomFlags' | 'ceilingScopes' | 'trimScopes' | 'doorScopes'
  >
  meta: Pick<EstimateV2EditorMetaState, 'selectedRoomId' | 'validationIssues' | 'catalogs'>
  wallProductionRateById: ReturnType<
    typeof import('../_lib/estimateV2EditorDerived').buildProductionRateById
  >
  roomFlagById: ReturnType<typeof import('../_lib/estimateV2EditorDerived').buildRoomFlagById>
}) {
  const { collections, meta, wallProductionRateById, roomFlagById } = params

  const roomModeById = useMemo(
    () =>
      resolveRoomModeById({
        rooms: collections.rooms,
        wallScopes: collections.scopes,
        ceilingScopes: collections.ceilingScopes,
      }),
    [collections.ceilingScopes, collections.rooms, collections.scopes]
  )
  const selectedRoom =
    collections.rooms.find((room) => room.roomId === meta.selectedRoomId) ?? null
  const roomScopeByRoomId = useMemo(
    () => buildWallScopeByRoomId(collections.scopes),
    [collections.scopes]
  )
  const roomCeilingScopeByRoomId = useMemo(
    () => buildCeilingScopeByRoomId(collections.ceilingScopes),
    [collections.ceilingScopes]
  )
  const roomTrimScopeByRoomId = useMemo(
    () => buildTrimScopeByRoomId(collections.trimScopes),
    [collections.trimScopes]
  )
  const roomDoorScopeByRoomId = useMemo(
    () => buildDoorScopeByRoomId(collections.doorScopes),
    [collections.doorScopes]
  )
  const selectedRoomScopes = useMemo(
    () => roomScopeByRoomId.get(meta.selectedRoomId) ?? [],
    [meta.selectedRoomId, roomScopeByRoomId]
  )
  const selectedRoomCeilingScopes = useMemo(
    () => roomCeilingScopeByRoomId.get(meta.selectedRoomId) ?? [],
    [meta.selectedRoomId, roomCeilingScopeByRoomId]
  )
  const selectedRoomTrimScopes = useMemo(
    () => roomTrimScopeByRoomId.get(meta.selectedRoomId) ?? [],
    [meta.selectedRoomId, roomTrimScopeByRoomId]
  )
  const selectedRoomDoorScopes = useMemo(
    () => roomDoorScopeByRoomId.get(meta.selectedRoomId) ?? [],
    [meta.selectedRoomId, roomDoorScopeByRoomId]
  )
  const firstScope = selectedRoomScopes[0] ?? null
  const firstCeilingScope = selectedRoomCeilingScopes[0] ?? null
  const firstTrimScope = selectedRoomTrimScopes[0] ?? null
  const firstDoorScope = selectedRoomDoorScopes[0] ?? null
  const wallsIncluded = selectedRoomScopes.some((scope) => scope.include === 'Y')
  const ceilingsIncluded = selectedRoomCeilingScopes.some((scope) => scope.include === 'Y')
  const trimsIncluded = selectedRoomTrimScopes.some((scope) => scope.include === 'Y')
  const doorsIncluded = selectedRoomDoorScopes.some((scope) => scope.include === 'Y')
  const jobTrimsIncluded = collections.trimScopes.some((scope) => scope.include === 'Y')
  const jobDoorsIncluded = collections.doorScopes.some((scope) => scope.include === 'Y')
  const selectedRoomResolvedMode = selectedRoom
    ? roomModeById.get(selectedRoom.roomId) ?? 'RECT'
    : 'RECT'
  const selectedRoomGeometryMode = selectedRoomResolvedMode

  const roomComplexityFactorByRoomId = useMemo(
    () => buildRoomComplexityFactorByRoomId(collections.rooms, wallProductionRateById),
    [collections.rooms, wallProductionRateById]
  )
  const roomWallFlagFactorByRoomId = useMemo(
    () =>
      buildRoomFlagFactorByRoomId(
        collections.rooms,
        collections.roomFlags,
        roomFlagById,
        'wall_factor'
      ),
    [collections.roomFlags, collections.rooms, roomFlagById]
  )
  const roomCeilingFlagFactorByRoomId = useMemo(
    () =>
      buildRoomFlagFactorByRoomId(
        collections.rooms,
        collections.roomFlags,
        roomFlagById,
        'ceil_factor'
      ),
    [collections.roomFlags, collections.rooms, roomFlagById]
  )
  const roomTrimFlagFactorByRoomId = useMemo(
    () =>
      buildRoomFlagFactorByRoomId(
        collections.rooms,
        collections.roomFlags,
        roomFlagById,
        'trim_factor'
      ),
    [collections.roomFlags, collections.rooms, roomFlagById]
  )
  const roomHeightFactorByRoomId = useMemo(
    () => buildRoomHeightFactorByRoomId(collections.rooms, meta.catalogs.height_factors),
    [collections.rooms, meta.catalogs.height_factors]
  )
  const activeRoomFlagCount = useMemo(
    () =>
      selectedRoom
        ? collections.roomFlags.filter((flag) => flag.roomId === selectedRoom.roomId).length
        : 0,
    [collections.roomFlags, selectedRoom]
  )
  const selectedRoomIssueCount = useMemo(
    () =>
      selectedRoom
        ? meta.validationIssues.filter((issue) => issue.startsWith(`${selectedRoom.roomId}:`))
            .length
        : 0,
    [meta.validationIssues, selectedRoom]
  )

  return {
    roomModeById,
    selectedRoom,
    roomScopeByRoomId,
    roomCeilingScopeByRoomId,
    roomTrimScopeByRoomId,
    roomDoorScopeByRoomId,
    selectedRoomScopes,
    selectedRoomCeilingScopes,
    selectedRoomTrimScopes,
    selectedRoomDoorScopes,
    firstScope,
    firstCeilingScope,
    firstTrimScope,
    firstDoorScope,
    wallsIncluded,
    ceilingsIncluded,
    trimsIncluded,
    doorsIncluded,
    jobTrimsIncluded,
    jobDoorsIncluded,
    selectedRoomResolvedMode,
    selectedRoomGeometryMode,
    roomComplexityFactorByRoomId,
    roomWallFlagFactorByRoomId,
    roomCeilingFlagFactorByRoomId,
    roomTrimFlagFactorByRoomId,
    roomHeightFactorByRoomId,
    activeRoomFlagCount,
    selectedRoomIssueCount,
  }
}
