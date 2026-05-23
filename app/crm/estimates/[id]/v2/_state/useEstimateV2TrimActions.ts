'use client'

import { useCallback } from 'react'
import type {
  EstimateV2EditorStoreApi,
  EstimateV2EditorStoreState,
} from '@/lib/estimates/v2/store/estimateV2Store'
import {
  addTrimScopeMutation,
  applyTrimTypeMutation,
  deleteTrimScopeMutation,
  moveTrimScopeMutation,
  toggleRoomTrimIncludeMutation,
  updateTrimScopeMutation,
} from '../_lib/estimateV2EditorMutations'
import type { EstimateV2TrimTypeOption } from '@/types/estimator/v2Catalogs'
import {
  formatEstimateV2RoomLabel,
  formatEstimateV2TrimLabel,
  type EstimateV2DestructiveIntent,
} from './estimateV2DestructiveConfirm'

export function useEstimateV2TrimActions(params: {
  store: EstimateV2EditorStoreApi
  trimTypeOptions: EstimateV2TrimTypeOption[]
  roomModeById: Map<string, 'RECT' | 'SEG'>
  roomHeightFactorByRoomId: Map<string, string>
  requestDestructiveConfirm: (intent: EstimateV2DestructiveIntent) => void
}) {
  const { store, trimTypeOptions, roomModeById, roomHeightFactorByRoomId, requestDestructiveConfirm } = params

  const markDirty = useCallback(() => {
    store.getState().setDebugMeta((prev) => ({ ...prev, dirtySource: 'trim' }))
  }, [store])

  const updateScope = useCallback(
    (
      scopeId: string,
      patch: Partial<EstimateV2EditorStoreState['collections']['trimScopes'][number]>
    ) => {
      store.getState().setTrimScopes((prev) => updateTrimScopeMutation(prev, scopeId, patch))
      markDirty()
    },
    [markDirty, store]
  )

  const addScope = useCallback(
    (roomId: string) => {
      store.getState().setTrimScopes((prev) => addTrimScopeMutation(prev, roomId))
      markDirty()
    },
    [markDirty, store]
  )

  const moveScope = useCallback(
    (roomId: string, scopeId: string, direction: -1 | 1) => {
      store
        .getState()
        .setTrimScopes((prev) => moveTrimScopeMutation({ scopes: prev, roomId, scopeId, direction }))
      markDirty()
    },
    [markDirty, store]
  )

  const deleteScope = useCallback(
    (roomId: string, scopeId: string) => {
      const { collections } = store.getState()
      const room = collections.rooms.find((entry) => entry.roomId === roomId)
      const scope = collections.trimScopes.find((entry) => entry.id === scopeId)
      requestDestructiveConfirm({
        kind: 'trim-delete',
        roomId,
        roomLabel: formatEstimateV2RoomLabel(room?.roomName, roomId),
        scopeId,
        scopeLabel: formatEstimateV2TrimLabel(scope?.scopeName, scope?.trimTypeId, trimTypeOptions),
        run: () => {
          store.getState().setTrimScopes((prev) => deleteTrimScopeMutation(prev, roomId, scopeId))
          markDirty()
        },
      })
    },
    [markDirty, requestDestructiveConfirm, store, trimTypeOptions]
  )

  const toggleRoomInclude = useCallback(
    (roomId: string) => {
      const state = store.getState()
      state.setTrimScopes((prev) =>
        toggleRoomTrimIncludeMutation(prev, roomId, {
          rooms: state.collections.rooms,
          trimTypeOptions,
          roomModeById,
          roomHeightFactorByRoomId,
        })
      )
      markDirty()
    },
    [markDirty, roomHeightFactorByRoomId, roomModeById, store, trimTypeOptions]
  )

  const updateTrimType = useCallback(
    (scopeId: string, trimTypeId: string) => {
      store.getState().setTrimScopes((prev) =>
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
    [markDirty, roomHeightFactorByRoomId, roomModeById, store, trimTypeOptions]
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
