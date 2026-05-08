'use client'

import { useCallback } from 'react'
import type {
  EstimateV2EditorStoreApi,
} from '@/lib/estimates/v2/store/estimateV2Store'
import {
  addDoorScopeMutation,
  deleteDoorScopeMutation,
  moveDoorScopeMutation,
  toggleRoomDoorIncludeMutation,
  updateDoorScopeMutation,
} from '../_lib/estimateV2EditorMutations'
import type { EstimateV2DoorScopeDraft, EstimateV2DoorTypeOption } from '@/types/estimator/v2'
import {
  formatEstimateV2DoorLabel,
  formatEstimateV2RoomLabel,
  type EstimateV2DestructiveIntent,
} from './estimateV2DestructiveConfirm'

export function useEstimateV2DoorActions(params: {
  store: EstimateV2EditorStoreApi
  doorTypeOptions: EstimateV2DoorTypeOption[]
  requestDestructiveConfirm: (intent: EstimateV2DestructiveIntent) => void
}) {
  const { store, doorTypeOptions, requestDestructiveConfirm } = params

  const markDirty = useCallback(() => {
    store.getState().setDebugMeta((prev) => ({ ...prev, dirtySource: 'doors' }))
  }, [store])

  const updateScope = useCallback(
    (
      scopeId: string,
      patch: Partial<EstimateV2DoorScopeDraft>
    ) => {
      store.getState().setDoorScopes((prev) => updateDoorScopeMutation(prev, scopeId, patch))
      markDirty()
    },
    [markDirty, store]
  )

  const addScope = useCallback(
    (roomId: string) => {
      store.getState().setDoorScopes((prev) => addDoorScopeMutation(prev, roomId))
      markDirty()
    },
    [markDirty, store]
  )

  const moveScope = useCallback(
    (roomId: string, scopeId: string, direction: -1 | 1) => {
      store
        .getState()
        .setDoorScopes((prev) => moveDoorScopeMutation({ scopes: prev, roomId, scopeId, direction }))
      markDirty()
    },
    [markDirty, store]
  )

  const deleteScope = useCallback(
    (roomId: string, scopeId: string) => {
      const { collections } = store.getState()
      const room = collections.rooms.find((entry) => entry.roomId === roomId)
      const scope = (collections.doorScopes ?? []).find((entry) => entry.id === scopeId)
      requestDestructiveConfirm({
        kind: 'door-delete',
        roomId,
        roomLabel: formatEstimateV2RoomLabel(room?.roomName, roomId),
        scopeId,
        scopeLabel: formatEstimateV2DoorLabel(scope?.scopeName, scope?.doorTypeId, doorTypeOptions),
        run: () => {
          store.getState().setDoorScopes((prev) => deleteDoorScopeMutation(prev, roomId, scopeId))
          markDirty()
        },
      })
    },
    [doorTypeOptions, markDirty, requestDestructiveConfirm, store]
  )

  const toggleRoomInclude = useCallback(
    (roomId: string) => {
      store
        .getState()
        .setDoorScopes((prev) => toggleRoomDoorIncludeMutation(prev, roomId, { doorTypeOptions }))
      markDirty()
    },
    [doorTypeOptions, markDirty, store]
  )

  const updateDoorType = useCallback(
    (scopeId: string, doorTypeId: string) => {
      const option = doorTypeOptions.find((item) => item.id === doorTypeId)
      store.getState().setDoorScopes((prev) =>
        updateDoorScopeMutation(prev, scopeId, {
          doorTypeId,
          scopeName: option?.label ?? '',
        })
      )
      markDirty()
    },
    [doorTypeOptions, markDirty, store]
  )

  return {
    updateScope,
    addScope,
    moveScope,
    deleteScope,
    toggleRoomInclude,
    updateDoorType,
  }
}
