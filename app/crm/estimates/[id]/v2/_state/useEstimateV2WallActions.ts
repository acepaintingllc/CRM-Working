'use client'

import { useCallback } from 'react'
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
import type { EstimateV2EditorCollections, EstimateV2EditorMetaState } from './estimateV2EditorTypes'

export function useEstimateV2WallActions(params: {
  collections: EstimateV2EditorCollections
  meta: EstimateV2EditorMetaState
  roomModeById: Map<string, 'RECT' | 'SEG'>
}) {
  const { collections, meta, roomModeById } = params

  const markDirty = useCallback(() => {
    meta.setDebugMeta((prev) => ({ ...prev, dirtySource: 'walls' }))
  }, [meta])

  const updateScope = useCallback(
    (scopeId: string, patch: Partial<(typeof collections.scopes)[number]>) => {
      collections.setScopes((prev) => updateWallScopeMutation(prev, scopeId, patch))
      markDirty()
    },
    [collections, markDirty]
  )

  const updateSegment = useCallback(
    (segmentId: string, patch: Partial<(typeof collections.segments)[number]>) => {
      collections.setSegments((prev) =>
        prev.map((segment) => (segment.id === segmentId ? { ...segment, ...patch } : segment))
      )
      markDirty()
    },
    [collections, markDirty]
  )

  const addScope = useCallback(
    (roomId: string) => {
      collections.setScopes((prev) =>
        addWallScopeMutation({
          scopes: prev,
          roomId,
          defaultHeightFactor: '1',
        })
      )
      markDirty()
    },
    [collections, markDirty]
  )

  const moveScope = useCallback(
    (roomId: string, scopeId: string, direction: -1 | 1) => {
      collections.setScopes((prev) => moveWallScopeMutation({ scopes: prev, roomId, scopeId, direction }))
      markDirty()
    },
    [collections, markDirty]
  )

  const deleteScope = useCallback(
    (roomId: string, scopeId: string) => {
      const ok = window.confirm('Delete this wall scope and all of its segments?')
      if (!ok) return
      const next = deleteWallScopeMutation({
        scopes: collections.scopes,
        segments: collections.segments,
        roomId,
        scopeId,
      })
      collections.setScopes(next.scopes)
      collections.setSegments(next.segments)
      markDirty()
    },
    [collections, markDirty]
  )

  const addSegment = useCallback(
    (roomId: string, wallScopeId: string) => {
      collections.setSegments((prev) => addWallSegmentMutation(prev, roomId, wallScopeId))
      markDirty()
    },
    [collections, markDirty]
  )

  const moveSegment = useCallback(
    (wallScopeId: string, segmentId: string, direction: -1 | 1) => {
      collections.setSegments((prev) =>
        moveWallSegmentMutation({ segments: prev, wallScopeId, segmentId, direction })
      )
      markDirty()
    },
    [collections, markDirty]
  )

  const deleteSegment = useCallback(
    (wallScopeId: string, segmentId: string) => {
      collections.setSegments((prev) => deleteWallSegmentMutation(prev, wallScopeId, segmentId))
      markDirty()
    },
    [collections, markDirty]
  )

  const toggleRoomInclude = useCallback(
    (roomId: string) => {
      collections.setScopes((prev) =>
        toggleRoomWallIncludeMutation({
          scopes: prev,
          roomId,
          roomMode: roomModeById.get(roomId) ?? 'RECT',
          defaultHeightFactor: '1',
        })
      )
      markDirty()
    },
    [collections, markDirty, roomModeById]
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
