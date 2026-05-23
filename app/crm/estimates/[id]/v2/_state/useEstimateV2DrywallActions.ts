'use client'

import { useCallback } from 'react'
import type { EstimateV2EditorStoreApi } from '@/lib/estimates/v2/store/estimateV2Store'
import type { EstimateV2DrywallRateOption } from '@/types/estimator/v2Catalogs'
import type { EstimateV2DrywallRepairDraft } from '@/types/estimator/v2Scopes'
import {
  addDrywallRepairMutation,
  deleteDrywallRepairMutation,
  updateDrywallRepairMutation,
} from '../_lib/estimateV2EditorMutations'
import {
  formatEstimateV2DrywallLabel,
  formatEstimateV2RoomLabel,
  type EstimateV2DestructiveIntent,
} from './estimateV2DestructiveConfirm'

function inferDrywallUnit(repairType: string): EstimateV2DrywallRepairDraft['unit'] {
  return repairType === 'patch_opening_repair' ? 'SQFT' : 'LF'
}

export function useEstimateV2DrywallActions(params: {
  store: EstimateV2EditorStoreApi
  drywallRateOptions: EstimateV2DrywallRateOption[]
  requestDestructiveConfirm: (intent: EstimateV2DestructiveIntent) => void
}) {
  const { store, drywallRateOptions, requestDestructiveConfirm } = params

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
      const { collections } = store.getState()
      const room = collections.rooms.find((entry) => entry.roomId === roomId)
      const repair = (collections.drywallRepairs ?? []).find((entry) => entry.id === repairId)
      requestDestructiveConfirm({
        kind: 'drywall-delete',
        roomId,
        roomLabel: formatEstimateV2RoomLabel(room?.roomName, roomId),
        repairId,
        surfaceLabel: repair?.surface === 'ceiling' ? 'Ceiling' : 'Wall',
        repairLabel: formatEstimateV2DrywallLabel(repair?.repairType, drywallRateOptions),
        run: () => {
          store
            .getState()
            .setDrywallRepairs((prev) => deleteDrywallRepairMutation(prev, roomId, repairId))
          markDirty()
        },
      })
    },
    [drywallRateOptions, markDirty, requestDestructiveConfirm, store]
  )

  return {
    addRepair,
    updateRepair,
    updateRepairType,
    deleteRepair,
  }
}
