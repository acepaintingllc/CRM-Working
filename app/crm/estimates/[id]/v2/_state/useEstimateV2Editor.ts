'use client'

import { useEffect, useState } from 'react'
import {
  createEstimateV2Store,
  estimateV2StoreSelectors,
  useEstimateV2Store,
} from '@/lib/estimates/v2/store/estimateV2Store'
import {
  estimateRouteFamily,
  type EstimateRouteFamily,
} from '../../estimateRouteFamily'
import { useEstimateV2BeforeUnload } from './useEstimateV2BeforeUnload'
import { useEstimateV2CeilingActions } from './useEstimateV2CeilingActions'
import { useEstimateV2DerivedState } from './useEstimateV2DerivedState'
import { useEstimateV2EditorLoader } from './useEstimateV2EditorLoader'
import { useEstimateV2EditorViewModels } from './useEstimateV2EditorViewModels'
import { useEstimateV2RoomActions } from './useEstimateV2RoomActions'
import { useEstimateV2SaveController } from './useEstimateV2SaveController'
import { useEstimateV2SettingsActions } from './useEstimateV2SettingsActions'
import { useEstimateV2TrimActions } from './useEstimateV2TrimActions'
import { useEstimateV2WallActions } from './useEstimateV2WallActions'

export function useEstimateV2Editor({
  estimateId,
  routeFamily = estimateRouteFamily,
}: {
  estimateId?: string
  routeFamily?: EstimateRouteFamily
}) {
  const [store] = useState(() => createEstimateV2Store())
  const loading = useEstimateV2Store(store, estimateV2StoreSelectors.loading)
  const effectiveJobProductDefaults = useEstimateV2Store(
    store,
    estimateV2StoreSelectors.effectiveJobProductDefaults
  )

  const derived = useEstimateV2DerivedState({ store })

  useEstimateV2EditorLoader({
    estimateId,
    routeFamily,
    store,
  })
  useEstimateV2BeforeUnload({ loading, dirty: derived.dirty })

  useEffect(() => {
    if (!derived.defaultColorCodeId) return
    store.getState().setScopes((prev) => {
      let changed = false
      const next = prev.map((scope) => {
        if (scope.colorId) return scope
        changed = true
        return { ...scope, colorId: derived.defaultColorCodeId }
      })
      return changed ? next : prev
    })
  }, [derived.defaultColorCodeId, store])

  const roomActions = useEstimateV2RoomActions({
    store,
    roomModeById: derived.roomModeById,
    trimTypeOptions: derived.trimTypeOptions,
  })
  const wallActions = useEstimateV2WallActions({
    store,
    roomModeById: derived.roomModeById,
  })
  const ceilingActions = useEstimateV2CeilingActions({
    store,
    roomModeById: derived.roomModeById,
  })
  const trimActions = useEstimateV2TrimActions({
    store,
    trimTypeOptions: derived.trimTypeOptions,
    roomModeById: derived.roomModeById,
    roomHeightFactorByRoomId: derived.roomHeightFactorByRoomId,
  })
  const settingsActions = useEstimateV2SettingsActions({ estimateId, routeFamily, store })
  const saveController = useEstimateV2SaveController({
    estimateId,
    routeFamily,
    store,
    currentSnapshot: derived.currentSnapshot,
    dirty: derived.dirty,
    effectiveJobProductDefaults,
  })

  return useEstimateV2EditorViewModels({
    estimateId,
    store,
    derived,
    roomActions,
    wallActions,
    ceilingActions,
    trimActions,
    settingsActions,
    save: saveController.save,
  })
}
