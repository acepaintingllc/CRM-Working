'use client'

import { useCallback } from 'react'
import type {
  EstimateV2EditorStoreApi,
  EstimateV2EditorStoreState,
} from '@/lib/estimates/v2/store/estimateV2Store'
import {
  addCeilingScopeMutation,
  addCeilingSegmentMutation,
  deleteCeilingScopeMutation,
  deleteCeilingSegmentMutation,
  moveCeilingScopeMutation,
  moveCeilingSegmentMutation,
  syncWallCutInFromTrayCeilings,
  toggleRoomCeilingIncludeMutation,
  updateCeilingScopeMutation,
  updateCeilingSegmentMutation,
} from '../_lib/estimateV2EditorMutations'
import {
  formatEstimateV2RoomLabel,
  formatEstimateV2ScopeLabel,
  type EstimateV2DestructiveIntent,
} from './estimateV2DestructiveConfirm'

export function useEstimateV2CeilingActions(params: {
  store: EstimateV2EditorStoreApi
  roomModeById: Map<string, 'RECT' | 'SEG'>
  requestDestructiveConfirm: (intent: EstimateV2DestructiveIntent) => void
}) {
  const { store, roomModeById, requestDestructiveConfirm } = params

  const markDirty = useCallback(() => {
    store.getState().setDebugMeta((prev) => ({ ...prev, dirtySource: 'ceilings' }))
  }, [store])

  const updateScope = useCallback(
    (
      scopeId: string,
      patch: Partial<EstimateV2EditorStoreState['collections']['ceilingScopes'][number]>
    ) => {
      const state = store.getState()
      const nextCeilingScopes = updateCeilingScopeMutation(
        state.collections.ceilingScopes,
        scopeId,
        patch
      )
      state.setCeilingScopes(nextCeilingScopes)
      state.setScopes((prev) =>
        syncWallCutInFromTrayCeilings({ wallScopes: prev, ceilingScopes: nextCeilingScopes })
      )
      markDirty()
    },
    [markDirty, store]
  )

  const addScope = useCallback(
    (roomId: string) => {
      store.getState().setCeilingScopes((prev) =>
        addCeilingScopeMutation({
          scopes: prev,
          roomId,
          defaultHeightFactor: '1',
        })
      )
      markDirty()
    },
    [markDirty, store]
  )

  const deleteScope = useCallback(
    (roomId: string, scopeId: string) => {
      const { collections } = store.getState()
      const room = collections.rooms.find((entry) => entry.roomId === roomId)
      const scope = collections.ceilingScopes.find((entry) => entry.id === scopeId)
      const segmentCount = collections.ceilingSegments.filter(
        (segment) => segment.ceilingScopeId === scopeId
      ).length
      requestDestructiveConfirm({
        kind: 'ceiling-scope-delete',
        roomId,
        roomLabel: formatEstimateV2RoomLabel(room?.roomName, roomId),
        scopeId,
        scopeLabel: formatEstimateV2ScopeLabel(scope?.scopeName, 'Ceiling scope'),
        segmentCount,
        run: () => {
          const { collections: currentCollections, setCeilingScopes, setCeilingSegments } =
            store.getState()
          const next = deleteCeilingScopeMutation({
            scopes: currentCollections.ceilingScopes,
            segments: currentCollections.ceilingSegments,
            roomId,
            scopeId,
          })
          setCeilingScopes(next.scopes)
          setCeilingSegments(next.segments)
          store.getState().setScopes((prev) =>
            syncWallCutInFromTrayCeilings({ wallScopes: prev, ceilingScopes: next.scopes })
          )
          markDirty()
        },
      })
    },
    [markDirty, requestDestructiveConfirm, store]
  )

  const moveScope = useCallback(
    (roomId: string, scopeId: string, direction: -1 | 1) => {
      store.getState().setCeilingScopes((prev) =>
        moveCeilingScopeMutation({ scopes: prev, roomId, scopeId, direction })
      )
      markDirty()
    },
    [markDirty, store]
  )

  const addSegment = useCallback(
    (roomId: string, ceilingScopeId: string) => {
      store
        .getState()
        .setCeilingSegments((prev) => addCeilingSegmentMutation(prev, roomId, ceilingScopeId))
      markDirty()
    },
    [markDirty, store]
  )

  const deleteSegment = useCallback(
    (ceilingScopeId: string, segmentId: string) => {
      store.getState().setCeilingSegments((prev) =>
        deleteCeilingSegmentMutation(prev, ceilingScopeId, segmentId)
      )
      markDirty()
    },
    [markDirty, store]
  )

  const moveSegment = useCallback(
    (ceilingScopeId: string, segmentId: string, direction: -1 | 1) => {
      store.getState().setCeilingSegments((prev) =>
        moveCeilingSegmentMutation({ segments: prev, ceilingScopeId, segmentId, direction })
      )
      markDirty()
    },
    [markDirty, store]
  )

  const updateSegment = useCallback(
    (
      segmentId: string,
      patch: Partial<EstimateV2EditorStoreState['collections']['ceilingSegments'][number]>
    ) => {
      store
        .getState()
        .setCeilingSegments((prev) => updateCeilingSegmentMutation(prev, segmentId, patch))
      markDirty()
    },
    [markDirty, store]
  )

  const toggleRoomInclude = useCallback(
    (roomId: string) => {
      const state = store.getState()
      const nextCeilingScopes = toggleRoomCeilingIncludeMutation({
        scopes: state.collections.ceilingScopes,
        roomId,
        roomMode: roomModeById.get(roomId) ?? 'RECT',
        defaultHeightFactor: '1',
      })
      state.setCeilingScopes(nextCeilingScopes)
      state.setScopes((prev) =>
        syncWallCutInFromTrayCeilings({ wallScopes: prev, ceilingScopes: nextCeilingScopes })
      )
      markDirty()
    },
    [markDirty, roomModeById, store]
  )

  return {
    updateScope,
    addScope,
    deleteScope,
    moveScope,
    addSegment,
    deleteSegment,
    moveSegment,
    updateSegment,
    toggleRoomInclude,
  }
}
