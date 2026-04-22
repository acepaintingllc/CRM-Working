'use client'

import { useCallback } from 'react'
import {
  addCeilingScopeMutation,
  addCeilingSegmentMutation,
  deleteCeilingScopeMutation,
  deleteCeilingSegmentMutation,
  moveCeilingScopeMutation,
  moveCeilingSegmentMutation,
  toggleRoomCeilingIncludeMutation,
  updateCeilingScopeMutation,
  updateCeilingSegmentMutation,
} from '../_lib/estimateV2EditorMutations'
import type { EstimateV2EditorCollections, EstimateV2EditorMetaState } from './estimateV2EditorTypes'

export function useEstimateV2CeilingActions(params: {
  collections: EstimateV2EditorCollections
  meta: EstimateV2EditorMetaState
  roomModeById: Map<string, 'RECT' | 'SEG'>
}) {
  const { collections, meta, roomModeById } = params

  const markDirty = useCallback(() => {
    meta.setDebugMeta((prev) => ({ ...prev, dirtySource: 'ceilings' }))
  }, [meta])

  const updateScope = useCallback(
    (scopeId: string, patch: Partial<(typeof collections.ceilingScopes)[number]>) => {
      collections.setCeilingScopes((prev) => updateCeilingScopeMutation(prev, scopeId, patch))
      markDirty()
    },
    [collections, markDirty]
  )

  const addScope = useCallback(
    (roomId: string) => {
      collections.setCeilingScopes((prev) =>
        addCeilingScopeMutation({
          scopes: prev,
          roomId,
          defaultHeightFactor: '1',
        })
      )
      markDirty()
    },
    [collections, markDirty]
  )

  const deleteScope = useCallback(
    (roomId: string, scopeId: string) => {
      const ok = window.confirm('Delete this ceiling scope and all of its segments?')
      if (!ok) return
      const next = deleteCeilingScopeMutation({
        scopes: collections.ceilingScopes,
        segments: collections.ceilingSegments,
        roomId,
        scopeId,
      })
      collections.setCeilingScopes(next.scopes)
      collections.setCeilingSegments(next.segments)
      markDirty()
    },
    [collections, markDirty]
  )

  const moveScope = useCallback(
    (roomId: string, scopeId: string, direction: -1 | 1) => {
      collections.setCeilingScopes((prev) =>
        moveCeilingScopeMutation({ scopes: prev, roomId, scopeId, direction })
      )
      markDirty()
    },
    [collections, markDirty]
  )

  const addSegment = useCallback(
    (roomId: string, ceilingScopeId: string) => {
      collections.setCeilingSegments((prev) => addCeilingSegmentMutation(prev, roomId, ceilingScopeId))
      markDirty()
    },
    [collections, markDirty]
  )

  const deleteSegment = useCallback(
    (ceilingScopeId: string, segmentId: string) => {
      collections.setCeilingSegments((prev) =>
        deleteCeilingSegmentMutation(prev, ceilingScopeId, segmentId)
      )
      markDirty()
    },
    [collections, markDirty]
  )

  const moveSegment = useCallback(
    (ceilingScopeId: string, segmentId: string, direction: -1 | 1) => {
      collections.setCeilingSegments((prev) =>
        moveCeilingSegmentMutation({ segments: prev, ceilingScopeId, segmentId, direction })
      )
      markDirty()
    },
    [collections, markDirty]
  )

  const updateSegment = useCallback(
    (segmentId: string, patch: Partial<(typeof collections.ceilingSegments)[number]>) => {
      collections.setCeilingSegments((prev) => updateCeilingSegmentMutation(prev, segmentId, patch))
      markDirty()
    },
    [collections, markDirty]
  )

  const toggleRoomInclude = useCallback(
    (roomId: string) => {
      collections.setCeilingScopes((prev) =>
        toggleRoomCeilingIncludeMutation({
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
