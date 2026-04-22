'use client'

import { useCallback } from 'react'
import {
  addTrimScopeMutation,
  applyTrimTypeMutation,
  deleteTrimScopeMutation,
  moveTrimScopeMutation,
  toggleRoomTrimIncludeMutation,
  updateTrimScopeMutation,
} from '../_lib/estimateV2EditorMutations'
import type { EstimateV2EditorCollections, EstimateV2EditorMetaState } from './estimateV2EditorTypes'
import type { EstimateV2TrimTypeOption } from '@/types/estimator/v2'

export function useEstimateV2TrimActions(params: {
  collections: EstimateV2EditorCollections
  meta: EstimateV2EditorMetaState
  trimTypeOptions: EstimateV2TrimTypeOption[]
  roomModeById: Map<string, 'RECT' | 'SEG'>
  roomHeightFactorByRoomId: Map<string, string>
}) {
  const { collections, meta, trimTypeOptions, roomModeById, roomHeightFactorByRoomId } = params

  const markDirty = useCallback(() => {
    meta.setDebugMeta((prev) => ({ ...prev, dirtySource: 'trim' }))
  }, [meta])

  const updateScope = useCallback(
    (scopeId: string, patch: Partial<(typeof collections.trimScopes)[number]>) => {
      collections.setTrimScopes((prev) => updateTrimScopeMutation(prev, scopeId, patch))
      markDirty()
    },
    [collections, markDirty]
  )

  const addScope = useCallback(
    (roomId: string) => {
      collections.setTrimScopes((prev) => addTrimScopeMutation(prev, roomId))
      markDirty()
    },
    [collections, markDirty]
  )

  const moveScope = useCallback(
    (roomId: string, scopeId: string, direction: -1 | 1) => {
      collections.setTrimScopes((prev) => moveTrimScopeMutation({ scopes: prev, roomId, scopeId, direction }))
      markDirty()
    },
    [collections, markDirty]
  )

  const deleteScope = useCallback(
    (roomId: string, scopeId: string) => {
      const ok = window.confirm('Delete this trim item?')
      if (!ok) return
      collections.setTrimScopes((prev) => deleteTrimScopeMutation(prev, roomId, scopeId))
      markDirty()
    },
    [collections, markDirty]
  )

  const toggleRoomInclude = useCallback(
    (roomId: string) => {
      collections.setTrimScopes((prev) => toggleRoomTrimIncludeMutation(prev, roomId))
      markDirty()
    },
    [collections, markDirty]
  )

  const updateTrimType = useCallback(
    (scopeId: string, trimTypeId: string) => {
      collections.setTrimScopes((prev) =>
        applyTrimTypeMutation({
          scopes: prev,
          scopeId,
          trimTypeId,
          trimTypeOptions,
          roomModeById,
          roomHeightFactorByRoomId,
        })
      )
      markDirty()
    },
    [collections, markDirty, roomHeightFactorByRoomId, roomModeById, trimTypeOptions]
  )

  return {
    updateScope,
    addScope,
    moveScope,
    deleteScope,
    toggleRoomInclude,
    updateTrimType,
  }
}
