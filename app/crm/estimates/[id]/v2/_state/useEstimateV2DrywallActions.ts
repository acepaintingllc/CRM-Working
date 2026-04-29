'use client'

import { useCallback } from 'react'
import type { EstimateV2EditorStoreApi } from '@/lib/estimates/v2/store/estimateV2Store'
import type { EstimateV2DrywallRateOption, EstimateV2DrywallRepairDraft } from '@/types/estimator/v2'
import {
  addDrywallRepairMutation,
  deleteDrywallRepairMutation,
  updateDrywallRepairMutation,
} from '../_lib/estimateV2EditorMutations'

function inferDrywallUnit(repairType: string): EstimateV2DrywallRepairDraft['unit'] {
  return repairType === 'patch_opening_repair' ? 'SQFT' : 'LF'
}

export function useEstimateV2DrywallActions(params: {
  store: EstimateV2EditorStoreApi
  drywallRateOptions: EstimateV2DrywallRateOption[]
}) {
  const { store, drywallRateOptions } = params

  const markDirty = useCallback(() => {
    store.getState().setDebugMeta((prev) => ({ ...prev, dirtySource: 'drywall' }))
  }, [store])

  const addRepair = useCallback(
    (roomId: string, surface: EstimateV2DrywallRepairDraft['surface'], repairType: string) => {
      store
        .getState()
        .setDrywallRepairs((prev) => addDrywallRepairMutation({ repairs: prev, roomId, surface, repairType }))
      markDirty()
    },
    [markDirty, store]
  )

  const updateRepair = useCallback(
    (repairId: string, patch: Partial<EstimateV2DrywallRepairDraft>) => {
      const nextPatch = patch.repairType
        ? { ...patch, unit: inferDrywallUnit(patch.repairType) }
        : patch
      store
        .getState()
        .setDrywallRepairs((prev) => updateDrywallRepairMutation(prev, repairId, nextPatch))
      markDirty()
    },
    [markDirty, store]
  )

  const updateRepairType = useCallback(
    (repairId: string, repairType: string) => {
      const option = drywallRateOptions.find((item) => item.id === repairType)
      updateRepair(repairId, {
        repairType,
        unit: option?.unit === 'SQFT' ? 'SQFT' : inferDrywallUnit(repairType),
      })
    },
    [drywallRateOptions, updateRepair]
  )

  const deleteRepair = useCallback(
    (roomId: string, repairId: string) => {
      const ok = window.confirm('Delete this drywall repair?')
      if (!ok) return
      store.getState().setDrywallRepairs((prev) => deleteDrywallRepairMutation(prev, roomId, repairId))
      markDirty()
    },
    [markDirty, store]
  )

  return {
    addRepair,
    updateRepair,
    updateRepairType,
    deleteRepair,
  }
}
