'use client'

import { useCallback } from 'react'
import {
  addRoomMutation,
  applyCeilingRoomModeMutation,
  applyWallRoomModeMutation,
  deleteRoomCascadeMutation,
  toggleRoomFlagMutation,
  updateRoomDimensionsMutation,
  updateRoomMutation,
} from '../_lib/estimateV2EditorMutations'
import { recalculateEditorDraftFactors } from '../_lib/estimateV2EditorRecalculate'
import type {
  EstimateV2EditorCollections,
  EstimateV2EditorMetaState,
  DirtySource,
} from './estimateV2EditorTypes'
import type { EstimateV2TrimTypeOption, EstimateV2WallScopeMode } from '@/types/estimator/v2'

export function useEstimateV2RoomActions(params: {
  collections: EstimateV2EditorCollections
  meta: EstimateV2EditorMetaState
  roomModeById: Map<string, 'RECT' | 'SEG'>
  trimTypeOptions: EstimateV2TrimTypeOption[]
}) {
  const { collections, meta, roomModeById, trimTypeOptions } = params
  const { catalogs, selectedRoomId, setDebugMeta, setSelectedRoomId } = meta

  const applySynchronizedDrafts = useCallback(
    (
      nextRooms = collections.rooms,
      nextWallScopes = collections.scopes,
      nextCeilingScopes = collections.ceilingScopes,
      nextTrimScopes = collections.trimScopes,
      nextRoomFlags = collections.roomFlags
    ) => {
      const recalculated = recalculateEditorDraftFactors({
        rooms: nextRooms,
        wallScopes: nextWallScopes,
        ceilingScopes: nextCeilingScopes,
        trimScopes: nextTrimScopes,
        roomFlags: nextRoomFlags,
        catalogs,
        trimTypeOptions,
      })
      collections.setScopes(recalculated.wallScopes)
      collections.setCeilingScopes(recalculated.ceilingScopes)
      collections.setTrimScopes(recalculated.trimScopes)
    },
    [catalogs, collections, trimTypeOptions]
  )

  const markDirty = useCallback(
    (source: DirtySource) => {
      setDebugMeta((prev) => ({ ...prev, dirtySource: source }))
    },
    [setDebugMeta]
  )

  const updateRoom = useCallback(
    (roomId: string, patch: Partial<(typeof collections.rooms)[number]>) => {
      const nextRooms = updateRoomMutation(collections.rooms, roomId, patch)
      collections.setRooms(nextRooms)
      applySynchronizedDrafts(nextRooms)
      markDirty('room')
    },
    [applySynchronizedDrafts, collections, markDirty]
  )

  const updateRoomComplexity = useCallback(
    (roomId: string, wallComplexityId: string) => {
      updateRoom(roomId, { wallComplexityId })
    },
    [updateRoom]
  )

  const addRoom = useCallback(() => {
    const next = addRoomMutation({
      rooms: collections.rooms,
      defaultHeightFactor: '1',
    })
    const nextRooms = next.rooms
    const nextWallScopes = [...collections.scopes, ...next.scopes]
    collections.setRooms(nextRooms)
    setSelectedRoomId(next.room.roomId)
    applySynchronizedDrafts(nextRooms, nextWallScopes)
    markDirty('room')
  }, [applySynchronizedDrafts, collections, markDirty, setSelectedRoomId])

  const deleteRoom = useCallback(
    (roomId: string) => {
      const roomScopes = collections.scopes.filter((scope) => scope.roomId === roomId)
      const roomSegments = collections.segments.filter((segment) => segment.roomId === roomId)
      const roomCeilScopes = collections.ceilingScopes.filter((scope) => scope.roomId === roomId)
      const roomCeilSegments = collections.ceilingSegments.filter((segment) => segment.roomId === roomId)
      const roomTrimRows = collections.trimScopes.filter((scope) => scope.roomId === roomId)
      const room = collections.rooms.find((entry) => entry.roomId === roomId)
      const label = room?.roomName || roomId
      const hasData =
        roomScopes.length > 0 ||
        roomSegments.length > 0 ||
        roomCeilScopes.length > 0 ||
        roomCeilSegments.length > 0 ||
        roomTrimRows.length > 0
      const ok = window.confirm(
        hasData ? `Delete ${label} and all scope rows/segments in it?` : `Delete ${label}?`
      )
      if (!ok) return

      const next = deleteRoomCascadeMutation({
        rooms: collections.rooms,
        scopes: collections.scopes,
        segments: collections.segments,
        roomFlags: collections.roomFlags,
        ceilingScopes: collections.ceilingScopes,
        ceilingSegments: collections.ceilingSegments,
        trimScopes: collections.trimScopes,
        roomId,
        selectedRoomId,
      })
      collections.setRooms(next.rooms)
      collections.setSegments(next.segments)
      collections.setRoomFlags(next.roomFlags)
      collections.setCeilingSegments(next.ceilingSegments)
      setSelectedRoomId(next.selectedRoomId)
      applySynchronizedDrafts(
        next.rooms,
        next.scopes,
        next.ceilingScopes,
        next.trimScopes,
        next.roomFlags
      )
      markDirty('room')
    },
    [applySynchronizedDrafts, collections, markDirty, selectedRoomId, setSelectedRoomId]
  )

  const toggleFlag = useCallback(
    (roomId: string, flagId: string) => {
      const nextRoomFlags = toggleRoomFlagMutation(collections.roomFlags, roomId, flagId)
      collections.setRoomFlags(nextRoomFlags)
      applySynchronizedDrafts(collections.rooms, collections.scopes, collections.ceilingScopes, collections.trimScopes, nextRoomFlags)
      markDirty('room-flags')
    },
    [applySynchronizedDrafts, collections, markDirty]
  )

  const handleRoomDimChange = useCallback(
    (roomId: string, field: 'lengthIn' | 'widthIn' | 'heightIn', value: string) => {
      const next = updateRoomDimensionsMutation({
        rooms: collections.rooms,
        scopes: collections.scopes,
        roomId,
        field,
        value,
      })
      collections.setRooms(next.rooms)
      applySynchronizedDrafts(next.rooms, next.scopes)
      markDirty('room')
    },
    [applySynchronizedDrafts, collections, markDirty]
  )

  const switchRoomGeometryMode = useCallback(
    (roomId: string, nextMode: EstimateV2WallScopeMode) => {
      const currentMode = roomModeById.get(roomId) ?? 'RECT'
      if (
        currentMode === 'SEG' &&
        nextMode === 'RECT' &&
        !window.confirm(
          'Switching this room back to RECT will reset all SEG wall and ceiling scopes/segments in the room. Continue?'
        )
      ) {
        return
      }

      const nextWalls = applyWallRoomModeMutation({
        scopes: collections.scopes,
        segments: collections.segments,
        roomId,
        nextMode,
        defaultHeightFactor: '1',
      })
      const nextCeilings = applyCeilingRoomModeMutation({
        scopes: collections.ceilingScopes,
        segments: collections.ceilingSegments,
        roomId,
        nextMode,
        defaultHeightFactor: '1',
      })

      collections.setSegments(nextWalls.segments)
      collections.setCeilingSegments(nextCeilings.segments)
      applySynchronizedDrafts(
        collections.rooms,
        nextWalls.scopes,
        nextCeilings.scopes,
        collections.trimScopes,
        collections.roomFlags
      )
      markDirty('room')
    },
    [applySynchronizedDrafts, collections, markDirty, roomModeById]
  )

  return {
    updateRoom,
    updateRoomComplexity,
    addRoom,
    deleteRoom,
    toggleFlag,
    handleRoomDimChange,
    switchRoomGeometryMode,
  }
}
