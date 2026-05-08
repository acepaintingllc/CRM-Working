'use client'

import { useCallback } from 'react'
import type {
  EstimateV2EditorStoreApi,
  EstimateV2EditorStoreState,
} from '@/lib/estimates/v2/store/estimateV2Store'
import {
  addWallScopeMutation,
  addWallSegmentMutation,
  deleteWallScopeMutation,
  deleteWallSegmentMutation,
  moveWallScopeMutation,
  moveWallSegmentMutation,
  toggleRoomWallIncludeMutation,
  updateWallScopeMutation,
} from '../_lib/estimateV2EditorMutations'
import {
  formatEstimateV2RoomLabel,
  formatEstimateV2ScopeLabel,
  type EstimateV2DestructiveIntent,
} from './estimateV2DestructiveConfirm'

export function useEstimateV2WallActions(params: {
  store: EstimateV2EditorStoreApi
  roomModeById: Map<string, 'RECT' | 'SEG'>
  requestDestructiveConfirm: (intent: EstimateV2DestructiveIntent) => void
}) {
  const { store, roomModeById, requestDestructiveConfirm } = params

  const markDirty = useCallback(() => {
    store.getState().setDebugMeta((prev) => ({ ...prev, dirtySource: 'walls' }))
  }, [store])

  const updateScope = useCallback(
    (
      scopeId: string,
      patch: Partial<EstimateV2EditorStoreState['collections']['scopes'][number]>
    ) => {
      store.getState().setScopes((prev) => updateWallScopeMutation(prev, scopeId, patch))
      markDirty()
    },
    [markDirty, store]
  )

  const updateSegment = useCallback(
    (
      segmentId: string,
      patch: Partial<EstimateV2EditorStoreState['collections']['segments'][number]>
    ) => {
      store.getState().setSegments((prev) =>
        prev.map((segment) => (segment.id === segmentId ? { ...segment, ...patch } : segment))
      )
      markDirty()
    },
    [markDirty, store]
  )

  const addScope = useCallback(
    (roomId: string) => {
      store.getState().setScopes((prev) =>
        addWallScopeMutation({
          scopes: prev,
          roomId,
          defaultHeightFactor: '1',
        })
      )
      markDirty()
    },
    [markDirty, store]
  )

  const moveScope = useCallback(
    (roomId: string, scopeId: string, direction: -1 | 1) => {
      store
        .getState()
        .setScopes((prev) => moveWallScopeMutation({ scopes: prev, roomId, scopeId, direction }))
      markDirty()
    },
    [markDirty, store]
  )

  const deleteScope = useCallback(
    (roomId: string, scopeId: string) => {
      const { collections } = store.getState()
      const room = collections.rooms.find((entry) => entry.roomId === roomId)
      const scope = collections.scopes.find((entry) => entry.id === scopeId)
      const segmentCount = collections.segments.filter((segment) => segment.wallScopeId === scopeId).length
      requestDestructiveConfirm({
        kind: 'wall-scope-delete',
        roomId,
        roomLabel: formatEstimateV2RoomLabel(room?.roomName, roomId),
        scopeId,
        scopeLabel: formatEstimateV2ScopeLabel(scope?.scopeName, 'Wall scope'),
        segmentCount,
        run: () => {
          const { collections: currentCollections, setScopes, setSegments } = store.getState()
          const next = deleteWallScopeMutation({
            scopes: currentCollections.scopes,
            segments: currentCollections.segments,
            roomId,
            scopeId,
          })
          setScopes(next.scopes)
          setSegments(next.segments)
          markDirty()
        },
      })
    },
    [markDirty, requestDestructiveConfirm, store]
  )

  const addSegment = useCallback(
    (roomId: string, wallScopeId: string) => {
      store.getState().setSegments((prev) => addWallSegmentMutation(prev, roomId, wallScopeId))
      markDirty()
    },
    [markDirty, store]
  )

  const moveSegment = useCallback(
    (wallScopeId: string, segmentId: string, direction: -1 | 1) => {
      store.getState().setSegments((prev) =>
        moveWallSegmentMutation({ segments: prev, wallScopeId, segmentId, direction })
      )
      markDirty()
    },
    [markDirty, store]
  )

  const deleteSegment = useCallback(
    (wallScopeId: string, segmentId: string) => {
      store.getState().setSegments((prev) => deleteWallSegmentMutation(prev, wallScopeId, segmentId))
      markDirty()
    },
    [markDirty, store]
  )

  const toggleRoomInclude = useCallback(
    (roomId: string) => {
      store.getState().setScopes((prev) =>
        toggleRoomWallIncludeMutation({
          scopes: prev,
          roomId,
          roomMode: roomModeById.get(roomId) ?? 'RECT',
          defaultHeightFactor: '1',
        })
      )
      markDirty()
    },
    [markDirty, roomModeById, store]
  )

  return {
    updateScope,
    updateSegment,
    addScope,
    moveScope,
    deleteScope,
    addSegment,
    moveSegment,
    deleteSegment,
    toggleRoomInclude,
  }
}
