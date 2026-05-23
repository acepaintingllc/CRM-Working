'use client'

import { useCallback } from 'react'
import type { EstimateV2EditorStoreApi } from '@/lib/estimates/v2/store/estimateV2Store'
import type { EstimateV2OtherItemDraft } from '@/types/estimator/v2Scopes'

function createOtherId() {
  return `other-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createOtherItem(roomId: string, position: number): EstimateV2OtherItemDraft {
  return {
    id: createOtherId(),
    roomId,
    position,
    include: 'Y',
    description: '',
    customerLabel: '',
    pricingMode: 'fixed',
    quantity: '1',
    unitRate: '',
    laborHours: '',
    laborRate: '',
    materialCost: '',
    supplyCost: '',
    fixedAmount: '',
    rollupTarget: 'other',
    customerVisibility: 'standalone',
    internalNotes: '',
  }
}

export function useEstimateV2OtherActions(params: {
  store: EstimateV2EditorStoreApi
}) {
  const { store } = params

  const addItem = useCallback(
    (roomId = '') => {
      const current = store.getState().collections.otherItems ?? []
      const roomItems = current.filter((item) => item.roomId === roomId)
      store.getState().setOtherItems([
        ...current,
        createOtherItem(roomId, roomItems.length),
      ])
      store.getState().setDebugMeta((prev) => ({ ...prev, dirtySource: 'other' }))
    },
    [store]
  )

  const updateItem = useCallback(
    (itemId: string, patch: Partial<EstimateV2OtherItemDraft>) => {
      store.getState().setOtherItems((items) =>
        items.map((item) => (item.id === itemId ? { ...item, ...patch } : item))
      )
      store.getState().setDebugMeta((prev) => ({ ...prev, dirtySource: 'other' }))
    },
    [store]
  )

  const duplicateItem = useCallback(
    (itemId: string) => {
      const current = store.getState().collections.otherItems ?? []
      const source = current.find((item) => item.id === itemId)
      if (!source) return
      const position = current.filter((item) => item.roomId === source.roomId).length
      store.getState().setOtherItems([
        ...current,
        { ...source, id: createOtherId(), position },
      ])
      store.getState().setDebugMeta((prev) => ({ ...prev, dirtySource: 'other' }))
    },
    [store]
  )

  const deleteItem = useCallback(
    (itemId: string) => {
      store.getState().setOtherItems((items) => items.filter((item) => item.id !== itemId))
      store.getState().setDebugMeta((prev) => ({ ...prev, dirtySource: 'other' }))
    },
    [store]
  )

  const moveItem = useCallback(
    (itemId: string, direction: -1 | 1) => {
      const current = [...(store.getState().collections.otherItems ?? [])]
      const index = current.findIndex((item) => item.id === itemId)
      if (index < 0) return
      const item = current[index]
      const sameRoomIndexes = current
        .map((candidate, candidateIndex) => ({ candidate, candidateIndex }))
        .filter(({ candidate }) => candidate.roomId === item.roomId)
      const roomIndex = sameRoomIndexes.findIndex(({ candidate }) => candidate.id === itemId)
      const swap = sameRoomIndexes[roomIndex + direction]
      if (!swap) return
      current[index] = { ...swap.candidate, position: item.position }
      current[swap.candidateIndex] = { ...item, position: swap.candidate.position }
      store.getState().setOtherItems(current)
      store.getState().setDebugMeta((prev) => ({ ...prev, dirtySource: 'other' }))
    },
    [store]
  )

  return {
    addItem,
    updateItem,
    duplicateItem,
    deleteItem,
    moveItem,
  }
}
