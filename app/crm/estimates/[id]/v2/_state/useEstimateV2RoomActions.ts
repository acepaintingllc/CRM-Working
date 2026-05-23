'use client'

import { useCallback } from 'react'
import type {
  EstimateV2EditorStoreApi,
  EstimateV2EditorStoreState,
} from '@/lib/estimates/v2/store/estimateV2Store'
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
import type { DirtySource } from './estimateV2EditorTypes'
import type { EstimateV2TrimTypeOption } from '@/types/estimator/v2Catalogs'
import type { EstimateV2WallScopeMode } from '@/types/estimator/v2Scopes'
import {
  formatEstimateV2RoomLabel,
  type EstimateV2DestructiveIntent,
} from './estimateV2DestructiveConfirm'

export function useEstimateV2RoomActions(params: {
  store: EstimateV2EditorStoreApi
  roomModeById: Map<string, 'RECT' | 'SEG'>
  trimTypeOptions: EstimateV2TrimTypeOption[]
  requestDestructiveConfirm: (intent: EstimateV2DestructiveIntent) => void
}) {
  const { store, roomModeById, trimTypeOptions, requestDestructiveConfirm } = params

  const applySynchronizedDrafts = useCallback(
    (
      nextRooms?: EstimateV2EditorStoreState['collections']['rooms'],
      nextWallScopes?: EstimateV2EditorStoreState['collections']['scopes'],
      nextCeilingScopes?: EstimateV2EditorStoreState['collections']['ceilingScopes'],
      nextTrimScopes?: EstimateV2EditorStoreState['collections']['trimScopes'],
      nextRoomFlags?: EstimateV2EditorStoreState['collections']['roomFlags']
    ) => {
      const { collections, meta, setScopes, setCeilingScopes, setTrimScopes } = store.getState()
      const recalculated = recalculateEditorDraftFactors({
        rooms: nextRooms ?? collections.rooms,
        wallScopes: nextWallScopes ?? collections.scopes,
        ceilingScopes: nextCeilingScopes ?? collections.ceilingScopes,
        trimScopes: nextTrimScopes ?? collections.trimScopes,
        roomFlags: nextRoomFlags ?? collections.roomFlags,
        catalogs: meta.catalogs,
        trimTypeOptions,
      })
      setScopes(recalculated.wallScopes)
      setCeilingScopes(recalculated.ceilingScopes)
      setTrimScopes(recalculated.trimScopes)
    },
    [store, trimTypeOptions]
  )

  const markDirty = useCallback(
    (source: DirtySource) => {
      store.getState().setDebugMeta((prev) => ({ ...prev, dirtySource: source }))
    },
    [store]
  )

  const updateRoom = useCallback(
    (
      roomId: string,
      patch: Partial<EstimateV2EditorStoreState['collections']['rooms'][number]>
    ) => {
      const { collections, setRooms } = store.getState()
      const nextRooms = updateRoomMutation(collections.rooms, roomId, patch)
      setRooms(nextRooms)
      applySynchronizedDrafts(nextRooms)
      markDirty('room')
    },
    [applySynchronizedDrafts, markDirty, store]
  )

  const updateRoomComplexity = useCallback(
    (roomId: string, wallComplexityId: string) => {
      updateRoom(roomId, { wallComplexityId })
    },
    [updateRoom]
  )

  const addRoom = useCallback(() => {
    const { collections, setRooms, setSelectedRoomId } = store.getState()
    const next = addRoomMutation({
      rooms: collections.rooms,
      defaultHeightFactor: '1',
    })
    const nextRooms = next.rooms
    const nextWallScopes = [...collections.scopes, ...next.scopes]
    setRooms(nextRooms)
    setSelectedRoomId(next.room.roomId)
    applySynchronizedDrafts(nextRooms, nextWallScopes)
    markDirty('room')
  }, [applySynchronizedDrafts, markDirty, store])

  const deleteRoom = useCallback(
    (roomId: string) => {
      const { collections } = store.getState()
      const roomScopes = collections.scopes.filter((scope) => scope.roomId === roomId)
      const roomSegments = collections.segments.filter((segment) => segment.roomId === roomId)
      const roomCeilScopes = collections.ceilingScopes.filter((scope) => scope.roomId === roomId)
      const roomCeilSegments = collections.ceilingSegments.filter((segment) => segment.roomId === roomId)
      const roomTrimRows = collections.trimScopes.filter((scope) => scope.roomId === roomId)
      const roomDoorRows = (collections.doorScopes ?? []).filter((scope) => scope.roomId === roomId)
      const roomDrywallRows = (collections.drywallRepairs ?? []).filter(
        (repair) => repair.roomId === roomId
      )
      const room = collections.rooms.find((entry) => entry.roomId === roomId)
      const hasData =
        roomScopes.length > 0 ||
        roomSegments.length > 0 ||
        roomCeilScopes.length > 0 ||
        roomCeilSegments.length > 0 ||
        roomTrimRows.length > 0 ||
        roomDoorRows.length > 0
        || roomDrywallRows.length > 0
      requestDestructiveConfirm({
        kind: 'room-delete',
        roomId,
        roomLabel: formatEstimateV2RoomLabel(room?.roomName, roomId),
        hasNestedData: hasData,
        run: () => {
          const {
            collections: currentCollections,
            meta,
            setRooms,
            setSegments,
            setRoomFlags,
            setCeilingSegments,
            setDoorScopes,
            setDrywallRepairs,
            setSelectedRoomId,
          } = store.getState()
          const next = deleteRoomCascadeMutation({
            rooms: currentCollections.rooms,
            scopes: currentCollections.scopes,
            segments: currentCollections.segments,
            roomFlags: currentCollections.roomFlags,
            ceilingScopes: currentCollections.ceilingScopes,
            ceilingSegments: currentCollections.ceilingSegments,
            trimScopes: currentCollections.trimScopes,
            doorScopes: currentCollections.doorScopes ?? [],
            drywallRepairs: currentCollections.drywallRepairs ?? [],
            roomId,
            selectedRoomId: meta.selectedRoomId,
          })
          setRooms(next.rooms)
          setSegments(next.segments)
          setRoomFlags(next.roomFlags)
          setCeilingSegments(next.ceilingSegments)
          setDoorScopes(next.doorScopes)
          setDrywallRepairs(next.drywallRepairs)
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
      })
    },
    [applySynchronizedDrafts, markDirty, requestDestructiveConfirm, store]
  )

  const toggleFlag = useCallback(
    (roomId: string, flagId: string) => {
      const { collections, setRoomFlags } = store.getState()
      const nextRoomFlags = toggleRoomFlagMutation(collections.roomFlags, roomId, flagId)
      setRoomFlags(nextRoomFlags)
      applySynchronizedDrafts(
        collections.rooms,
        collections.scopes,
        collections.ceilingScopes,
        collections.trimScopes,
        nextRoomFlags
      )
      markDirty('room-flags')
    },
    [applySynchronizedDrafts, markDirty, store]
  )

  const handleRoomDimChange = useCallback(
    (roomId: string, field: 'lengthIn' | 'widthIn' | 'heightIn', value: string) => {
      const { collections, setRooms } = store.getState()
      const next = updateRoomDimensionsMutation({
        rooms: collections.rooms,
        scopes: collections.scopes,
        ceilingScopes: collections.ceilingScopes,
        roomId,
        field,
        value,
      })
      setRooms(next.rooms)
      applySynchronizedDrafts(next.rooms, next.scopes, next.ceilingScopes)
      markDirty('room')
    },
    [applySynchronizedDrafts, markDirty, store]
  )

  const switchRoomGeometryMode = useCallback(
    (roomId: string, nextMode: EstimateV2WallScopeMode) => {
      const { collections } = store.getState()
      const currentMode = roomModeById.get(roomId) ?? 'RECT'
      const room = collections.rooms.find((entry) => entry.roomId === roomId)
      if (currentMode === 'SEG' && nextMode === 'RECT') {
        requestDestructiveConfirm({
          kind: 'room-geometry-reset',
          roomId,
          roomLabel: formatEstimateV2RoomLabel(room?.roomName, roomId),
          nextMode,
          run: () => {
            const { collections: currentCollections, setSegments, setCeilingSegments } =
              store.getState()
            const nextWalls = applyWallRoomModeMutation({
              scopes: currentCollections.scopes,
              segments: currentCollections.segments,
              roomId,
              nextMode,
              defaultHeightFactor: '1',
            })
            const nextCeilings = applyCeilingRoomModeMutation({
              scopes: currentCollections.ceilingScopes,
              segments: currentCollections.ceilingSegments,
              roomId,
              nextMode,
              defaultHeightFactor: '1',
            })

            setSegments(nextWalls.segments)
            setCeilingSegments(nextCeilings.segments)
            applySynchronizedDrafts(
              currentCollections.rooms,
              nextWalls.scopes,
              nextCeilings.scopes,
              currentCollections.trimScopes,
              currentCollections.roomFlags
            )
            markDirty('room')
          },
        })
        return
      }

      const { setSegments, setCeilingSegments } = store.getState()
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

      setSegments(nextWalls.segments)
      setCeilingSegments(nextCeilings.segments)
      applySynchronizedDrafts(
        collections.rooms,
        nextWalls.scopes,
        nextCeilings.scopes,
        collections.trimScopes,
        collections.roomFlags
      )
      markDirty('room')
    },
    [applySynchronizedDrafts, markDirty, requestDestructiveConfirm, roomModeById, store]
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
